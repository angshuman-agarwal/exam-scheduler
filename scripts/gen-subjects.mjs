// Generate subjects.json for tier-split GCSE 2026
import { writeFileSync } from 'fs'

const T = (id, paperId, offeringId, name) => ({
  id, paperId, offeringId, name,
  confidence: 3, performanceScore: 0.5, lastReviewed: null
})

const boards = [
  { id: "aqa", name: "AQA" },
  { id: "edexcel", name: "Edexcel" },
  { id: "ocr", name: "OCR" }
]

const subjects = [
  { id: "cs", name: "Computer Science", color: "#3B82F6" },
  { id: "eng-lit", name: "English Literature", color: "#8B5CF6" },
  { id: "bio", name: "Biology", color: "#10B981" },
  { id: "rs", name: "R.S.", color: "#F59E0B" },
  { id: "geo", name: "Geography", color: "#6366F1" },
  { id: "maths", name: "Maths", color: "#EF4444" },
  { id: "chem", name: "Chemistry", color: "#F97316" },
  { id: "eng-lang", name: "English Language", color: "#A855F7" },
  { id: "phys", name: "Physics", color: "#06B6D4" },
  { id: "music", name: "Music", color: "#EC4899" },
  { id: "spanish", name: "Spanish", color: "#14B8A6" },
  { id: "add-maths", name: "Additional Maths", color: "#64748B" },
  { id: "history", name: "History", color: "#D97706" },
  { id: "french", name: "French", color: "#2563EB" },
  { id: "further-maths", name: "Further Mathematics", color: "#7C3AED" }
]

const offerings = []
const papers = []
const topics = []

// ═══ UNCHANGED SUBJECTS ═══

// CS - AQA 8525
offerings.push({ id: "cs-aqa", subjectId: "cs", boardId: "aqa", spec: "8525", label: "AQA 8525", qualificationId: "gcse" })
papers.push({ id: "cs-p1", offeringId: "cs-aqa", name: "Paper 1", examDate: "2026-05-13", examTime: "13:30" })
papers.push({ id: "cs-p2", offeringId: "cs-aqa", name: "Paper 2", examDate: "2026-05-19", examTime: "13:30" })
;["Sorting and searching algorithms","Pseudo-code","Flowcharts","Random number generation","Arrays","Records","File handling","Subroutines"].forEach((n,i) =>
  topics.push(T(`cs-${String(i+1).padStart(3,'0')}`, "cs-p1", "cs-aqa", n)))
;["Data representation","Computer systems","Networks","Cybersecurity","Ethical impacts","SQL"].forEach((n,i) =>
  topics.push(T(`cs-${String(i+9).padStart(3,'0')}`, "cs-p2", "cs-aqa", n)))

// Eng Lit - AQA 8702
offerings.push({ id: "eng-lit-aqa", subjectId: "eng-lit", boardId: "aqa", spec: "8702", label: "AQA 8702", qualificationId: "gcse" })
papers.push({ id: "eng-lit-p1", offeringId: "eng-lit-aqa", name: "Paper 1", examDate: "2026-05-11", examTime: "09:00" })
papers.push({ id: "eng-lit-p2", offeringId: "eng-lit-aqa", name: "Paper 2", examDate: "2026-05-19", examTime: "09:00" })
;["Inspector Calls","Romeo and Juliet"].forEach((n,i) =>
  topics.push(T(`eng-lit-${String(i+1).padStart(3,'0')}`, "eng-lit-p1", "eng-lit-aqa", n)))
;["Jane Eyre","Poetry anthology","Unseen poetry"].forEach((n,i) =>
  topics.push(T(`eng-lit-${String(i+3).padStart(3,'0')}`, "eng-lit-p2", "eng-lit-aqa", n)))

// RS - AQA 8062 (add examTime to P1 per plan)
offerings.push({ id: "rs-aqa", subjectId: "rs", boardId: "aqa", spec: "8062", label: "AQA 8062", qualificationId: "gcse" })
papers.push({ id: "rs-p1", offeringId: "rs-aqa", name: "Paper 1", examDate: "2026-05-12", examTime: "09:00" })
papers.push({ id: "rs-p2", offeringId: "rs-aqa", name: "Paper 2", examDate: "2026-05-20", examTime: "13:30" })
;["Christianity","Islam"].forEach((n,i) =>
  topics.push(T(`rs-${String(i+1).padStart(3,'0')}`, "rs-p1", "rs-aqa", n)))
;["Peace and conflict","Family and relationships"].forEach((n,i) =>
  topics.push(T(`rs-${String(i+3).padStart(3,'0')}`, "rs-p2", "rs-aqa", n)))

// Geo - AQA 8035
offerings.push({ id: "geo-aqa", subjectId: "geo", boardId: "aqa", spec: "8035", label: "AQA 8035", qualificationId: "gcse" })
papers.push({ id: "geo-p1", offeringId: "geo-aqa", name: "Paper 1", examDate: "2026-05-13", examTime: "09:00" })
papers.push({ id: "geo-p2", offeringId: "geo-aqa", name: "Paper 2", examDate: "2026-06-03", examTime: "13:30" })
papers.push({ id: "geo-p3", offeringId: "geo-aqa", name: "Paper 3", examDate: "2026-06-11", examTime: "09:00" })
;["Tectonic hazards and climate change","Ecosystems and cold environment","Coasts and rivers"].forEach((n,i) =>
  topics.push(T(`geo-${String(i+1).padStart(3,'0')}`, "geo-p1", "geo-aqa", n)))
;["Urban issues","London and Lagos","Nigeria","Changing economic world","Managing resources"].forEach((n,i) =>
  topics.push(T(`geo-${String(i+4).padStart(3,'0')}`, "geo-p2", "geo-aqa", n)))
;["Unseen evaluation","Bexhill","Tonbridge","Ways of data representation"].forEach((n,i) =>
  topics.push(T(`geo-${String(i+9).padStart(3,'0')}`, "geo-p3", "geo-aqa", n)))

// Eng Lang - AQA 8700
offerings.push({ id: "eng-lang-aqa", subjectId: "eng-lang", boardId: "aqa", spec: "8700", label: "AQA 8700", qualificationId: "gcse" })
papers.push({ id: "eng-lang-p1", offeringId: "eng-lang-aqa", name: "Paper 1", examDate: "2026-05-21", examTime: "09:00" })
papers.push({ id: "eng-lang-p2", offeringId: "eng-lang-aqa", name: "Paper 2", examDate: "2026-06-05", examTime: "09:00" })
topics.push(T("eng-lang-001", "eng-lang-p1", "eng-lang-aqa", "Creative writing"))
topics.push(T("eng-lang-002", "eng-lang-p2", "eng-lang-aqa", "Non-fiction writing"))

// Music - Edexcel 1MU0 (rename paper per plan)
offerings.push({ id: "music-edexcel", subjectId: "music", boardId: "edexcel", spec: "1MU0", label: "Edexcel 1MU0", qualificationId: "gcse" })
papers.push({ id: "music-p1", offeringId: "music-edexcel", name: "Component 3: Appraising", examDate: "2026-06-05", examTime: "13:30" })
;["Conventions of pop","Rhythms of the world","Concerto through time"].forEach((n,i) =>
  topics.push(T(`music-${String(i+1).padStart(3,'0')}`, "music-p1", "music-edexcel", n)))

// Spanish - AQA 8698
offerings.push({ id: "spanish-aqa", subjectId: "spanish", boardId: "aqa", spec: "8698", label: "AQA 8698", qualificationId: "gcse" })
papers.push({ id: "spanish-p1", offeringId: "spanish-aqa", name: "Paper 1", examDate: "2026-06-09", examTime: "09:00" })
papers.push({ id: "spanish-p2", offeringId: "spanish-aqa", name: "Paper 2", examDate: "2026-06-09", examTime: "09:00" })
papers.push({ id: "spanish-p3", offeringId: "spanish-aqa", name: "Paper 3", examDate: "2026-06-16", examTime: "09:00" })
;["Identities and relationships","Healthy living and lifestyle","Education and work","Free time activities","Customs festivals and traditions","Celebrity culture","Travel and tourism","Technology","Sustainability"].forEach((n,i) =>
  topics.push(T(`spanish-${String(i+1).padStart(3,'0')}`, "spanish-p1", "spanish-aqa", n)))

// Add Maths - OCR 6993
offerings.push({ id: "add-maths-ocr", subjectId: "add-maths", boardId: "ocr", spec: "6993", label: "OCR 6993", qualificationId: "gcse" })
papers.push({ id: "add-maths-p1", offeringId: "add-maths-ocr", name: "Paper 1", examDate: "2026-06-15", examTime: "13:30" })
;["Logarithms","Permutations and combinations","Binomial expansion","Binomial distribution","Graph of circle not at origin","Trigonometric identities","Trigonometric equations","Recurrence relationships","Locating a root","Interval bisection","Linear programming","Factor theorem","Polynomial division","Kinematics","Integration","Differentiation"].forEach((n,i) =>
  topics.push(T(`add-maths-${String(i+1).padStart(3,'0')}`, "add-maths-p1", "add-maths-ocr", n)))

// ═══ TIERED SUBJECTS ═══

// Helper: add F+H offering pair
function addTiered(subjectId, boardKey, boardId, spec, labelF, labelH) {
  const fId = `${subjectId}-${boardKey}-f`
  const hId = `${subjectId}-${boardKey}-h`
  offerings.push({ id: fId, subjectId, boardId, spec, label: labelF, qualificationId: "gcse" })
  offerings.push({ id: hId, subjectId, boardId, spec, label: labelH, qualificationId: "gcse" })
  return [fId, hId]
}

// Helper: add tiered papers (same date, different offering)
function addTieredPapers(baseId, fOid, hOid, paperDefs) {
  const fPaperIds = []
  const hPaperIds = []
  for (const [name, date, time] of paperDefs) {
    const fPid = `${baseId}-f-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`
    const hPid = `${baseId}-h-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`
    const fP = { id: fPid, offeringId: fOid, name, examDate: date }
    const hP = { id: hPid, offeringId: hOid, name, examDate: date }
    if (time) { fP.examTime = time; hP.examTime = time }
    papers.push(fP)
    papers.push(hP)
    fPaperIds.push(fPid)
    hPaperIds.push(hPid)
  }
  return [fPaperIds, hPaperIds]
}

// Helper: add topics to both F and H
function addTieredTopics(prefix, fOid, hOid, fPaperIds, hPaperIds, topicsByPaper) {
  let idx = 1
  for (let p = 0; p < topicsByPaper.length; p++) {
    for (const name of topicsByPaper[p]) {
      const num = String(idx).padStart(3, '0')
      topics.push(T(`${prefix}-f-${num}`, fPaperIds[p], fOid, name))
      topics.push(T(`${prefix}-h-${num}`, hPaperIds[p], hOid, name))
      idx++
    }
  }
}

// ─── MATHS ───

// Maths AQA 8300 (replaces maths-aqa)
{
  const [fId, hId] = addTiered("maths", "aqa", "aqa", "8300", "AQA 8300 Foundation", "AQA 8300 Higher")
  const [fP, hP] = addTieredPapers("maths-aqa", fId, hId, [
    ["Paper 1", "2026-05-19", "09:00"],
    ["Paper 2", "2026-06-04", "09:00"],
    ["Paper 3", "2026-06-11", "09:00"]
  ])
  const topicsByPaper = [
    ["Fractions, decimals and percentages","Indices and standard form","Surds","Ratio and proportion","Algebra and equations","Sequences"],
    ["Geometry and measures","Trigonometry","Vectors"],
    ["Statistics and probability"]
  ]
  addTieredTopics("maths-aqa", fId, hId, fP, hP, topicsByPaper)
}

// Maths Edexcel 1MA1 (replaces maths-edexcel)
{
  const [fId, hId] = addTiered("maths", "edexcel", "edexcel", "1MA1", "Edexcel 1MA1 Foundation", "Edexcel 1MA1 Higher")
  const [fP, hP] = addTieredPapers("maths-edexcel", fId, hId, [
    ["Paper 1", "2026-05-14", "09:00"],
    ["Paper 2", "2026-06-03", "09:00"],
    ["Paper 3", "2026-06-10", "09:00"]
  ])
  // Edexcel maths topics spread across all 3 papers (any topic can appear on any paper)
  // We assign them to Paper 1 as the primary grouping
  const topicsByPaper = [
    [
      "Fractions, decimals and percentages","Indices and standard form","Surds",
      "Bounds and error intervals","Ratio and proportion","Growth and decay",
      "Speed, distance and time","Compound measures","Prime factors, HCF and LCM",
      "Set notation and Venn diagrams","Recurring decimals","Expressions and substitution",
      "Expanding and factorising","Linear equations","Simultaneous equations",
      "Quadratic equations","Completing the square","Inequalities",
      "Sequences and nth term","Straight line graphs","Quadratic graphs",
      "Cubic, reciprocal and exponential graphs","Graph transformations","Algebraic fractions",
      "Functions and iteration","Algebraic proof","Direct and inverse proportion",
      "Angles and polygons","Circle theorems","Transformations",
      "Congruence and similarity","Pythagoras theorem","Trigonometry (SOHCAHTOA)",
      "Sine and cosine rule","3D Pythagoras and trigonometry","Trigonometric graphs",
      "Vectors","Constructions and loci","Bearings",
      "Area and perimeter","Volume and surface area","Circle area and circumference",
      "Arc length and sector area","Units and conversions","Plans and elevations",
      "Averages and range","Frequency tables and grouped data","Charts and diagrams",
      "Scatter graphs and correlation","Cumulative frequency and box plots","Histograms",
      "Sampling methods","Comparing distributions","Basic probability",
      "Combined events","Tree diagrams","Conditional probability",
      "Venn diagrams for probability","Relative frequency","Equation of a circle"
    ],
    [],
    []
  ]
  addTieredTopics("maths-edexcel", fId, hId, fP, hP, topicsByPaper)
}

// Maths OCR J560 (new)
{
  const [fId, hId] = addTiered("maths", "ocr", "ocr", "J560", "OCR J560 Foundation", "OCR J560 Higher")
  const [fP, hP] = addTieredPapers("maths-ocr", fId, hId, [
    ["Paper 1", "2026-05-14", "13:30"],
    ["Paper 2", "2026-06-03", "13:30"],
    ["Paper 3", "2026-06-10", "13:30"]
  ])
  const topicsByPaper = [
    [
      "Fractions, decimals and percentages","Indices and standard form","Surds",
      "Ratio and proportion","Algebra and equations","Sequences",
      "Geometry and measures","Trigonometry","Vectors","Statistics and probability"
    ],
    [],
    []
  ]
  addTieredTopics("maths-ocr", fId, hId, fP, hP, topicsByPaper)
}

// ─── BIOLOGY ───

// Bio AQA 8461 (replaces bio-aqa)
{
  const [fId, hId] = addTiered("bio", "aqa", "aqa", "8461", "AQA 8461 Foundation", "AQA 8461 Higher")
  const [fP, hP] = addTieredPapers("bio-aqa", fId, hId, [
    ["Paper 1", "2026-05-12", "13:30"],
    ["Paper 2", "2026-06-08", "09:00"]
  ])
  const topicsByPaper = [
    ["Cells tissues organs","Animal and plant organisation","Cell division","Digestive system","Breathing and circulatory system","Plants and bioenergetics","Health and disease"],
    ["Homeostasis","Ecology","Evolution and genetics"]
  ]
  addTieredTopics("bio-aqa", fId, hId, fP, hP, topicsByPaper)
}

// Bio OCR A (Gateway) J247 (new)
{
  const [fId, hId] = addTiered("bio", "ocr-a", "ocr", "J247", "OCR Biology A Foundation", "OCR Biology A Higher")
  const [fP, hP] = addTieredPapers("bio-ocr-a", fId, hId, [
    ["Paper 1", "2026-05-12", "09:00"],
    ["Paper 2", "2026-06-08", "13:30"]
  ])
  const topicsByPaper = [
    ["Cell biology","Organisation in animals and plants","Communicable diseases","Bioenergetics","Homeostasis and response"],
    ["Inheritance, variation and evolution","Ecology","Key concepts in biology"]
  ]
  addTieredTopics("bio-ocr-a", fId, hId, fP, hP, topicsByPaper)
}

// Bio OCR B (Twenty First Century) J257 (new)
{
  const [fId, hId] = addTiered("bio", "ocr-b", "ocr", "J257", "OCR Biology B Foundation", "OCR Biology B Higher")
  const [fP, hP] = addTieredPapers("bio-ocr-b", fId, hId, [
    ["Paper 1", "2026-05-15", "09:00"],
    ["Paper 2", "2026-06-09", "13:30"]
  ])
  const topicsByPaper = [
    ["You and your genes","Keeping healthy","Living together - food and ecosystems"],
    ["Using food and controlling growth","The human body - staying alive","Life on Earth - past, present and future"]
  ]
  addTieredTopics("bio-ocr-b", fId, hId, fP, hP, topicsByPaper)
}

// ─── CHEMISTRY ───

// Chem AQA 8462 (replaces chem-aqa)
{
  const [fId, hId] = addTiered("chem", "aqa", "aqa", "8462", "AQA 8462 Foundation", "AQA 8462 Higher")
  const [fP, hP] = addTieredPapers("chem-aqa", fId, hId, [
    ["Paper 1", "2026-05-18", "09:00"],
    ["Paper 2", "2026-06-12", "09:00"]
  ])
  const topicsByPaper = [
    ["Atomic structure","Periodic table","Bonding and structure","Metals","Acids and bases","Quantitative chemistry","Electrolysis","Energy changes"],
    ["Organics","Chemical analysis","Equilibrium and rate of reaction","Chemistry of atmosphere","Haber process and using resources"]
  ]
  addTieredTopics("chem-aqa", fId, hId, fP, hP, topicsByPaper)
}

// Chem OCR A (Gateway) J248 (new)
{
  const [fId, hId] = addTiered("chem", "ocr-a", "ocr", "J248", "OCR Chemistry A Foundation", "OCR Chemistry A Higher")
  const [fP, hP] = addTieredPapers("chem-ocr-a", fId, hId, [
    ["Paper 1", "2026-05-18", "13:30"],
    ["Paper 2", "2026-06-12", "13:30"]
  ])
  const topicsByPaper = [
    ["Particles","Elements, compounds and mixtures","Chemical reactions","Predicting and identifying reactions","Monitoring chemical reactions"],
    ["Global challenges","Organic chemistry","Quantitative chemistry","Chemical analysis"]
  ]
  addTieredTopics("chem-ocr-a", fId, hId, fP, hP, topicsByPaper)
}

// Chem OCR B (Twenty First Century) J258 (new)
{
  const [fId, hId] = addTiered("chem", "ocr-b", "ocr", "J258", "OCR Chemistry B Foundation", "OCR Chemistry B Higher")
  const [fP, hP] = addTieredPapers("chem-ocr-b", fId, hId, [
    ["Paper 1", "2026-05-20", "09:00"],
    ["Paper 2", "2026-06-15", "09:00"]
  ])
  const topicsByPaper = [
    ["Air and water","Chemical patterns","Chemicals of the natural environment"],
    ["Material choices","Chemical analysis and making useful chemicals","Ideas about science"]
  ]
  addTieredTopics("chem-ocr-b", fId, hId, fP, hP, topicsByPaper)
}

// ─── PHYSICS ───

// Phys AQA 8463 (replaces phys-aqa)
{
  const [fId, hId] = addTiered("phys", "aqa", "aqa", "8463", "AQA 8463 Foundation", "AQA 8463 Higher")
  const [fP, hP] = addTieredPapers("phys-aqa", fId, hId, [
    ["Paper 1", "2026-06-02", "09:00"],
    ["Paper 2", "2026-06-15", "09:00"]
  ])
  const topicsByPaper = [
    ["Energy","Heating","Electricity and domestic","Radioactivity","Molecules and matter"],
    ["Forces","Waves","Electromagnetism","Space physics"]
  ]
  addTieredTopics("phys-aqa", fId, hId, fP, hP, topicsByPaper)
}

// Phys OCR A (Gateway) J249 (new)
{
  const [fId, hId] = addTiered("phys", "ocr-a", "ocr", "J249", "OCR Physics A Foundation", "OCR Physics A Higher")
  const [fP, hP] = addTieredPapers("phys-ocr-a", fId, hId, [
    ["Paper 1", "2026-06-02", "13:30"],
    ["Paper 2", "2026-06-16", "09:00"]
  ])
  const topicsByPaper = [
    ["Forces and motion","Energy","Waves","Electricity","Magnetism and electromagnetism"],
    ["Radioactivity","Astrophysics","Global challenges"]
  ]
  addTieredTopics("phys-ocr-a", fId, hId, fP, hP, topicsByPaper)
}

// Phys OCR B (Twenty First Century) J259 (new)
{
  const [fId, hId] = addTiered("phys", "ocr-b", "ocr", "J259", "OCR Physics B Foundation", "OCR Physics B Higher")
  const [fP, hP] = addTieredPapers("phys-ocr-b", fId, hId, [
    ["Paper 1", "2026-06-04", "13:30"],
    ["Paper 2", "2026-06-17", "09:00"]
  ])
  const topicsByPaper = [
    ["Radiation and waves","Sustainable energy","Electric circuits"],
    ["Explaining motion","Radioactive materials","Matter - models and explanations"]
  ]
  addTieredTopics("phys-ocr-b", fId, hId, fP, hP, topicsByPaper)
}

// ─── FRENCH (new subject, tiered) ───

// French AQA 8658
{
  const [fId, hId] = addTiered("french", "aqa", "aqa", "8658", "AQA 8658 Foundation", "AQA 8658 Higher")
  const [fP, hP] = addTieredPapers("french-aqa", fId, hId, [
    ["Paper 1: Listening", "2026-06-09", "09:00"],
    ["Paper 3: Reading", "2026-06-09", "09:00"],
    ["Paper 4: Writing", "2026-06-16", "09:00"]
  ])
  const topicsByPaper = [
    ["Listening comprehension","Dictation and transcription"],
    ["Reading comprehension","Translation into English"],
    ["Writing in French","Translation into French"]
  ]
  addTieredTopics("french-aqa", fId, hId, fP, hP, topicsByPaper)
}

// French Edexcel 1FR1
{
  const [fId, hId] = addTiered("french", "edexcel", "edexcel", "1FR1", "Edexcel 1FR1 Foundation", "Edexcel 1FR1 Higher")
  const [fP, hP] = addTieredPapers("french-edexcel", fId, hId, [
    ["Paper 1: Listening", "2026-06-10", "09:00"],
    ["Paper 3: Reading", "2026-06-10", "09:00"],
    ["Paper 4: Writing", "2026-06-17", "09:00"]
  ])
  const topicsByPaper = [
    ["Listening comprehension","Dictation and transcription"],
    ["Reading comprehension","Translation into English"],
    ["Writing in French","Translation into French"]
  ]
  addTieredTopics("french-edexcel", fId, hId, fP, hP, topicsByPaper)
}

// ─── HISTORY (new subject, non-tiered) ───
offerings.push({ id: "history-aqa", subjectId: "history", boardId: "aqa", spec: "8145", label: "AQA 8145", qualificationId: "gcse" })
papers.push({ id: "history-p1", offeringId: "history-aqa", name: "Paper 1", examDate: "2026-06-01", examTime: "09:00" })
papers.push({ id: "history-p2", offeringId: "history-aqa", name: "Paper 2", examDate: "2026-06-08", examTime: "13:30" })
;[
  "America 1920-1973: Opportunity and inequality",
  "Conflict and tension 1894-1918",
  "Germany 1890-1945: Democracy and dictatorship"
].forEach((n,i) =>
  topics.push(T(`history-${String(i+1).padStart(3,'0')}`, "history-p1", "history-aqa", n)))
;[
  "Norman England c1066-c1100",
  "The Peoples Health c1250 to present"
].forEach((n,i) =>
  topics.push(T(`history-${String(i+4).padStart(3,'0')}`, "history-p2", "history-aqa", n)))

// ─── FURTHER MATHS (new subject, non-tiered) ───
offerings.push({ id: "further-maths-aqa", subjectId: "further-maths", boardId: "aqa", spec: "8365", label: "AQA 8365", qualificationId: "gcse" })
papers.push({ id: "further-maths-p1", offeringId: "further-maths-aqa", name: "Paper 1", examDate: "2026-06-12", examTime: "13:30" })
papers.push({ id: "further-maths-p2", offeringId: "further-maths-aqa", name: "Paper 2", examDate: "2026-06-17", examTime: "13:30" })
;[
  "Coordinate geometry","Trigonometric functions","Algebraic proof",
  "Matrices","Series and limits"
].forEach((n,i) =>
  topics.push(T(`further-maths-${String(i+1).padStart(3,'0')}`, "further-maths-p1", "further-maths-aqa", n)))
;[
  "Calculus","Factor theorem","Sequences",
  "Combinatorics","Inequalities and graphs"
].forEach((n,i) =>
  topics.push(T(`further-maths-${String(i+6).padStart(3,'0')}`, "further-maths-p2", "further-maths-aqa", n)))

// ═══ OUTPUT ═══
const seed = { version: 2, boards, subjects, offerings, papers, topics }

// Verify uniqueness
const ids = { offerings: new Set(), papers: new Set(), topics: new Set() }
for (const o of offerings) { if (ids.offerings.has(o.id)) throw new Error(`Duplicate offering: ${o.id}`); ids.offerings.add(o.id) }
for (const p of papers) { if (ids.papers.has(p.id)) throw new Error(`Duplicate paper: ${p.id}`); ids.papers.add(p.id) }
for (const t of topics) { if (ids.topics.has(t.id)) throw new Error(`Duplicate topic: ${t.id}`); ids.topics.add(t.id) }

// Verify referential integrity
for (const o of offerings) { if (!subjects.find(s => s.id === o.subjectId)) throw new Error(`Offering ${o.id} refs missing subject ${o.subjectId}`) }
for (const p of papers) { if (!ids.offerings.has(p.offeringId)) throw new Error(`Paper ${p.id} refs missing offering ${p.offeringId}`) }
for (const t of topics) { if (!ids.papers.has(t.paperId)) throw new Error(`Topic ${t.id} refs missing paper ${t.paperId}`); if (!ids.offerings.has(t.offeringId)) throw new Error(`Topic ${t.id} refs missing offering ${t.offeringId}`) }

console.log(`Offerings: ${offerings.length}`)
console.log(`Papers: ${papers.length}`)
console.log(`Topics: ${topics.length}`)

writeFileSync(new URL('../src/data/subjects.json', import.meta.url), JSON.stringify(seed, null, 2) + '\n')
console.log('Written to src/data/subjects.json')
