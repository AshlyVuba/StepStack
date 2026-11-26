// Exercise content for each tier, in English plus two South African languages
// (isiZulu "zu", Afrikaans "af"). Add a language by adding its code to every
// `text` block and to UI; tests/exercises.test.mjs enforces completeness.
// NOTE: isiZulu text is a draft and should be reviewed by a native speaker.

export const UI = {
  en: {
    language: 'Language', hint: 'Show hint', answer: 'Your answer', check: 'Check answer',
    next: 'Next stage', progress: 'Progress: {n}/{total}', stageN: 'Stage {n}',
    stages: ['Stage 1 · Micro-drill', 'Stage 2 · Guided challenge', 'Stage 3 · Capstone'],
    correct: 'Correct! Well done.', incorrect: 'Not quite. Try again.',
    empty: 'Type an answer first.', allDone: 'You finished all three stages. Great work!'
  },
  zu: {
    language: 'Ulimi', hint: 'Khombisa ithiphu', answer: 'Impendulo yakho', check: 'Hlola impendulo',
    next: 'Isigaba esilandelayo', progress: 'Inqubekela phambili: {n}/{total}', stageN: 'Isigaba {n}',
    stages: ['Isigaba 1 · Ukuzilolonga okufushane', 'Isigaba 2 · Umsebenzi oqondisiwe', 'Isigaba 3 · Iphrojekthi enkulu'],
    correct: 'Kulungile! Wenze kahle.', incorrect: 'Akukalungi. Zama futhi.',
    empty: 'Thayipha impendulo kuqala.', allDone: 'Uqedile zonke izigaba ezintathu. Wenze kahle kakhulu!'
  },
  af: {
    language: 'Taal', hint: 'Wys wenk', answer: 'Jou antwoord', check: 'Kontroleer antwoord',
    next: 'Volgende fase', progress: 'Vordering: {n}/{total}', stageN: 'Fase {n}',
    stages: ['Fase 1 · Mikro-oefening', 'Fase 2 · Begeleide uitdaging', 'Fase 3 · Afrondingsprojek'],
    correct: 'Reg! Goed gedoen.', incorrect: 'Nog nie reg nie. Probeer weer.',
    empty: 'Tik eers \u2019n antwoord.', allDone: 'Jy het al drie fases voltooi. Uitstekende werk!'
  }
};

// patterns: regex sources matched against the normalised answer (see grading.js)
// minLength: open-ended capstone, graded on a minimum answer length for now
export const EXERCISES = {
  foundational: [
    {
      id: 'f1', patterns: ['^(ctrl|control)\\+c$'],
      text: {
        en: { title: 'Copy shortcut', body: 'Type the keyboard shortcut that copies selected text.', hint: 'Think of the first letter of "copy". Format: ctrl+?' },
        zu: { title: 'Isinqamuleli sokukopisha', body: 'Thayipha isinqamuleli sekhibhodi esikopisha umbhalo okhethiwe.', hint: 'Cabanga ngohlamvu lokuqala lwegama elithi "copy". Isimo: ctrl+?' },
        af: { title: 'Kopieer-kortpad', body: 'Tik die sleutelbordkortpad wat gekose teks kopieer.', hint: 'Dink aan die eerste letter van "copy". Formaat: ctrl+?' }
      }
    },
    {
      id: 'f2', patterns: ['^\\.docx$'],
      text: {
        en: { title: 'File extensions', body: 'A file is named report final.docx. What is the file extension (including the dot)?', hint: 'It is the part at the end of the name, after the last dot.' },
        zu: { title: 'Izandiso zamafayela', body: 'Ifayela lithi report final.docx. Siyini isandiso salo (kubandakanya ichashazi)?', hint: 'Yingxenye ekupheleni kwegama, ngemva kwechashazi lokugcina.' },
        af: { title: 'Lêeruitbreidings', body: '\u2019n Lêer heet report final.docx. Wat is die lêeruitbreiding (insluitend die punt)?', hint: 'Dit is die deel aan die einde van die naam, na die laaste punt.' }
      }
    },
    {
      id: 'f3', minLength: 20,
      text: {
        en: { title: 'Write a memo', body: 'Write a short, formal memo to your manager requesting leave dates. Write at least 20 characters.', hint: 'Include a date, a subject line and a clear request.' },
        zu: { title: 'Bhala imemo', body: 'Bhala imemo emfushane esemthethweni eya kumphathi wakho ucela izinsuku zekhefu. Bhala okungenani izinhlamvu eziyi-20.', hint: 'Faka usuku, isihloko nesicelo esicacile.' },
        af: { title: 'Skryf \u2019n memo', body: 'Skryf \u2019n kort formele memo aan jou bestuurder om verlofdatums aan te vra. Skryf minstens 20 karakters.', hint: 'Sluit \u2019n datum, \u2019n onderwerp en \u2019n duidelike versoek in.' }
      }
    }
  ],
  workplace: [
    {
      id: 'w1', patterns: ['^=sum\\(a1:a5\\)$'],
      text: {
        en: { title: 'Add with SUM', body: 'Type the Excel formula that adds cells A1 to A5.', hint: 'Start with an equals sign and use the SUM function. Format: =SUM(...)' },
        zu: { title: 'Hlanganisa nge-SUM', body: 'Thayipha ifomula ye-Excel ehlanganisa amangqamuzana kusuka ku-A1 kuya ku-A5.', hint: 'Qala ngophawu olulinganayo, bese usebenzisa umsebenzi we-SUM. Isimo: =SUM(...)' },
        af: { title: 'Tel op met SUM', body: 'Tik die Excel-formule wat selle A1 tot A5 bymekaartel.', hint: 'Begin met \u2019n gelykaanteken en gebruik die SUM-funksie. Formaat: =SUM(...)' }
      }
    },
    {
      id: 'w2', patterns: ['^=average\\(b2:b10\\)$'],
      text: {
        en: { title: 'Find the average', body: 'Sales figures are in B2 to B10. Type the formula that calculates the average.', hint: 'Use the AVERAGE function with the range B2:B10.' },
        zu: { title: 'Thola isilinganiso', body: 'Izinombolo zokuthengisa ziku-B2 kuya ku-B10. Thayipha ifomula ekhipha isilinganiso.', hint: 'Sebenzisa umsebenzi we-AVERAGE nobubanzi be-B2:B10.' },
        af: { title: 'Vind die gemiddelde', body: 'Verkoopsyfers is in B2 tot B10. Tik die formule wat die gemiddelde bereken.', hint: 'Gebruik die AVERAGE-funksie met die reeks B2:B10.' }
      }
    },
    {
      id: 'w3', minLength: 20,
      text: {
        en: { title: 'Budget dashboard plan', body: 'Describe how you would build a monthly budget dashboard (at least 20 characters).', hint: 'Think about income, expenses and three key numbers to track.' },
        zu: { title: 'Uhlelo lwedeshibhodi yesabelomali', body: 'Chaza ukuthi ungayakha kanjani ideshibhodi yesabelomali senyanga ngayinye (okungenani izinhlamvu eziyi-20).', hint: 'Cabanga ngemali engenayo, izindleko nezinombolo ezibalulekile ezintathu.' },
        af: { title: 'Begrotingsdashboard-plan', body: 'Beskryf hoe jy \u2019n maandelikse begrotingsdashboard sal bou (minstens 20 karakters).', hint: 'Dink aan inkomste, uitgawes en drie sleutelsyfers.' }
      }
    }
  ],
  developer: [
    {
      id: 'd1', patterns: ['^print\\("hello"\\)$'],
      text: {
        en: { title: 'Print a greeting', body: 'Type the Python code that prints the word Hello.', hint: 'Use the print function with text inside quotation marks.' },
        zu: { title: 'Phrinta isibingelelo', body: 'Thayipha ikhodi ye-Python ephrinta igama elithi Hello.', hint: 'Sebenzisa umsebenzi we-print nombhalo ophakathi kwezicaphuno.' },
        af: { title: 'Druk \u2019n groet', body: 'Tik die Python-kode wat die woord Hello druk.', hint: 'Gebruik die print-funksie met teks tussen aanhalingstekens.' }
      }
    },
    {
      id: 'd2', patterns: ['^for\\w+inrange\\((0,)?5\\):?$'],
      text: {
        en: { title: 'Loop five times', body: 'Write the Python loop line that repeats 5 times using range.', hint: 'Format: for i in range(...):' },
        zu: { title: 'Phindaphinda kahlanu', body: 'Bhala umugqa we-loop ye-Python ophindaphinda izikhathi ezi-5 usebenzisa i-range.', hint: 'Isimo: for i in range(...):' },
        af: { title: 'Lus vyf keer', body: 'Skryf die Python-lusreël wat 5 keer herhaal met range.', hint: 'Formaat: for i in range(...):' }
      }
    },
    {
      id: 'd3', minLength: 20,
      text: {
        en: { title: 'Ship a feature', body: 'Describe the steps to deploy a complete full-stack feature (at least 20 characters).', hint: 'Think about the API, the back end and the front end.' },
        zu: { title: 'Khipha isici', body: 'Chaza izinyathelo zokukhipha isici esiphelele se-full-stack (okungenani izinhlamvu eziyi-20).', hint: 'Cabanga nge-API, ingxenye yangemuva neyangaphambili.' },
        af: { title: 'Ontplooi \u2019n funksie', body: 'Beskryf die stappe om \u2019n volledige full-stack-funksie te ontplooi (minstens 20 karakters).', hint: 'Dink aan die API, die agterkant en die voorkant.' }
      }
    }
  ]
};