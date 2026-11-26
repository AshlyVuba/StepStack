"""
Python grading harness. Runs INSIDE Pyodide (WebAssembly) inside a single-use, permission-restricted,
env-less Node process. Defence in depth, in order:
  1. AST gate   - rejects imports outside an allowlist, dunder/frame/format-string reflection, eval/exec/open...
  2. Builtins   - user code runs with a hand-picked builtins dict (no eval/exec/open/getattr/type/__import__)
  3. Imports    - allowed modules are exposed as namespaces of PUBLIC, NON-MODULE attributes only
                  (so `typing.sys`, `random._os`, `operator.attrgetter` style escapes don't exist)
  4. Process    - the parent kills this process on timeout; it is discarded after one submission.
"""
import ast, json, math, types, sys, builtins as _b

sys.setrecursionlimit(300)

ALLOWED_MODULES = {
    "math", "statistics", "itertools", "functools", "collections", "string", "re", "random",
    "datetime", "json", "typing", "decimal", "fractions", "heapq", "bisect", "copy",
}
BLOCKED_NAMES = {
    "eval", "exec", "compile", "open", "input", "breakpoint", "globals", "locals", "vars", "getattr",
    "setattr", "delattr", "exit", "quit", "help", "memoryview", "type", "dir", "__import__",
}
ALLOWED_DUNDER_ATTRS = {"__init__"}
BLOCKED_ATTRS = {
    "format", "format_map", "Formatter", "vformat", "get_field", "get_value", "mro",
    "f_back", "f_globals", "f_locals", "f_builtins", "f_code", "f_trace",
}
BLOCKED_ATTR_PREFIXES = ("gi_", "cr_", "ag_", "tb_", "co_")

SAFE_NAMES = """abs all any bin bool bytes callable chr complex dict divmod enumerate filter float frozenset
hash hex id int isinstance issubclass iter len list map max min next object oct ord pow range repr reversed
round set slice sorted str sum super tuple zip True False None NotImplemented Ellipsis
BaseException Exception ArithmeticError AssertionError AttributeError IndexError KeyError KeyboardInterrupt
LookupError NameError OverflowError RecursionError RuntimeError StopIteration TypeError ValueError
ZeroDivisionError __build_class__""".split()


class Reject(Exception):
    pass


def validate(tree):
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                if "." in a.name or a.name not in ALLOWED_MODULES:
                    raise Reject(f"import of '{a.name}' is not allowed")
        elif isinstance(node, ast.ImportFrom):
            m = node.module or ""
            if node.level or "." in m or m not in ALLOWED_MODULES:
                raise Reject(f"import from '{m}' is not allowed")
            if any(a.name == "*" for a in node.names):
                raise Reject("'import *' is not allowed")
        elif isinstance(node, ast.Name):
            if node.id in BLOCKED_NAMES or (node.id.startswith("__") and node.id != "__name__"):
                raise Reject(f"use of '{node.id}' is not allowed")
        elif isinstance(node, ast.Attribute):
            a = node.attr
            if (a.startswith("_") and a not in ALLOWED_DUNDER_ATTRS) or a in BLOCKED_ATTRS or a.startswith(BLOCKED_ATTR_PREFIXES):
                raise Reject(f"access to attribute '{a}' is not allowed")
        elif isinstance(node, (ast.AsyncFunctionDef, ast.Await, ast.AsyncFor, ast.AsyncWith)):
            raise Reject("async code is not allowed")


_real_import = _b.__import__


def _make_sandbox_builtins():
    safe = {n: getattr(_b, n) for n in SAFE_NAMES if hasattr(_b, n)}
    cache = {}

    def guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
        if level or name not in ALLOWED_MODULES:
            raise ImportError(f"import of '{name}' is not allowed")
        if name not in cache:
            mod = _real_import(name)
            cache[name] = types.SimpleNamespace(**{
                k: v for k, v in vars(mod).items()
                if not k.startswith("_") and not isinstance(v, types.ModuleType)
            })
        return cache[name]

    safe["__import__"] = guarded_import
    safe["print"] = lambda *a, **k: None  # output is not graded; also prevents output floods
    return safe


def _norm(x):
    if isinstance(x, (tuple, list)):
        return [_norm(i) for i in x]
    if isinstance(x, (set, frozenset)):
        return sorted(_norm(i) for i in x)
    if isinstance(x, dict):
        return {str(k): _norm(v) for k, v in x.items()}
    return x


def _same(a, b):
    if isinstance(a, bool) != isinstance(b, bool):
        return False
    if isinstance(a, float) or isinstance(b, float):
        try:
            return math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-9)
        except TypeError:
            return False
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(_same(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(_same(a[k], b[k]) for k in a)
    return a == b


def _short(s, n=160):
    s = str(s)
    return s if len(s) <= n else s[:n] + "..."


def run_submission(code, fn_name, tests_json):
    tests = json.loads(tests_json)
    try:
        tree = ast.parse(code, "<submission>")
    except SyntaxError as e:
        return json.dumps({"status": "error", "message": f"SyntaxError on line {e.lineno}: {_short(e.msg)}"})
    try:
        validate(tree)
    except Reject as e:
        return json.dumps({"status": "rejected", "message": str(e)})

    g = {"__builtins__": _make_sandbox_builtins(), "__name__": "submission"}
    try:
        exec(compile(tree, "<submission>", "exec"), g)
    except Exception as e:
        return json.dumps({"status": "error", "message": f"{type(e).__name__}: {_short(e)}"})

    fn = g.get(fn_name)
    if not callable(fn):
        return json.dumps({"status": "error", "message": f"Define a function called '{fn_name}'."})

    results = []
    for t in tests:
        try:
            got = _norm(fn(*t["args"]))
            json.dumps(got)
            ok = _same(got, t["expected"])
            results.append({"passed": ok, "message": "" if ok else (
                "Wrong answer on a hidden test." if t.get("hidden") else
                f"For input {_short(json.dumps(t['args']))} expected {_short(json.dumps(t['expected']))} but got {_short(json.dumps(got))}.")})
        except Exception as e:
            results.append({"passed": False, "message": f"{type(e).__name__}: {_short(e)}"})
    return json.dumps({"status": "ok", "tests": results})
