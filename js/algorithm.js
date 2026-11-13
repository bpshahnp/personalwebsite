/* ============================================
   algorithm.js — Algorithm & Flowchart Page
   - Renders topic cards with algorithm steps
   - Draws SVG flowcharts in a modal
   - "See Python Program" button deep-links to python.html#<slug>
   ============================================ */

/* ---------- Slugify (matches python-hub.js) ---------- */
function slugify(str) {
  return String(str == null ? "" : str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ---------- Algorithm Data ----------
   Each entry:
   {
     title        : string  — displayed as card heading
     pythonTitle  : string  — exact title in Python Hub (for hash deep-link)
     category     : string  — chip filter label
     description  : string  — short card description
     steps        : string[] — ordered algorithm steps
     flowchart    : object  — node/edge definition for SVG renderer
   }
   flowchart nodes:
   { id, label, shape: "terminal"|"process"|"decision"|"io", x, y, w, h }
   flowchart edges:
   { from, to, label? }
------------------------------------------------ */
const ALGORITHMS = [
  {
    title: "Find Largest of Two Numbers",
    pythonTitle: "Find Largest of Two Numbers",
    category: "Basics",
    description: "Compare two numbers and print whichever is larger.",
    steps: [
      "Start",
      "Input two numbers A and B",
      "If A > B then print A is larger",
      "Else print B is larger (or they are equal)",
      "Stop"
    ],
    flowchart: {
      nodes: [
        { id: "s", label: "Start", shape: "terminal", x: 160, y: 20,  w: 110, h: 36 },
        { id: "i", label: "Input A, B", shape: "io",       x: 160, y: 90,  w: 110, h: 36 },
        { id: "d", label: "A > B ?",   shape: "decision",  x: 160, y: 165, w: 110, h: 50 },
        { id: "pA", label: "Print A is larger", shape: "process", x: 50,  y: 265, w: 130, h: 36 },
        { id: "pB", label: "Print B is larger (or equal)", shape: "process", x: 240, y: 265, w: 150, h: 36 },
        { id: "e", label: "Stop",      shape: "terminal",  x: 160, y: 350, w: 110, h: 36 }
      ],
      edges: [
        { from: "s",  to: "i" },
        { from: "i",  to: "d" },
        { from: "d",  to: "pA", label: "Yes" },
        { from: "d",  to: "pB", label: "No" },
        { from: "pA", to: "e" },
        { from: "pB", to: "e" }
      ]
    }
  },
  {
    title: "Find Largest of Three Numbers",
    pythonTitle: "Find Largest of Three Numbers",
    category: "Basics",
    description: "Use nested conditions to find the greatest among A, B, and C.",
    steps: [
      "Start",
      "Input A, B, C",
      "If A >= B and A >= C then print A is largest",
      "Else if B >= C then print B is largest",
      "Else print C is largest",
      "Stop"
    ],
    flowchart: {
      nodes: [
        { id: "s",   label: "Start",           shape: "terminal", x: 180, y: 20,  w: 110, h: 36 },
        { id: "i",   label: "Input A, B, C",   shape: "io",       x: 180, y: 90,  w: 120, h: 36 },
        { id: "d1",  label: "A≥B and A≥C?",    shape: "decision", x: 180, y: 165, w: 130, h: 50 },
        { id: "pA",  label: "Print A largest", shape: "process",  x: 60,  y: 270, w: 120, h: 36 },
        { id: "d2",  label: "B ≥ C ?",         shape: "decision", x: 300, y: 270, w: 110, h: 50 },
        { id: "pB",  label: "Print B largest", shape: "process",  x: 220, y: 370, w: 120, h: 36 },
        { id: "pC",  label: "Print C largest", shape: "process",  x: 380, y: 370, w: 120, h: 36 },
        { id: "e",   label: "Stop",            shape: "terminal", x: 180, y: 460, w: 110, h: 36 }
      ],
      edges: [
        { from: "s",  to: "i" },
        { from: "i",  to: "d1" },
        { from: "d1", to: "pA",  label: "Yes" },
        { from: "d1", to: "d2",  label: "No" },
        { from: "d2", to: "pB",  label: "Yes" },
        { from: "d2", to: "pC",  label: "No" },
        { from: "pA", to: "e" },
        { from: "pB", to: "e" },
        { from: "pC", to: "e" }
      ]
    }
  },
  {
    title: "Check Even or Odd",
    pythonTitle: "Even or Odd",
    category: "Basics",
    description: "Determine whether a number is even or odd using modulo.",
    steps: [
      "Start",
      "Input a number N",
      "If N mod 2 = 0 then print 'Even'",
      "Else print 'Odd'",
      "Stop"
    ],
    flowchart: {
      nodes: [
        { id: "s",  label: "Start",        shape: "terminal", x: 160, y: 20,  w: 110, h: 36 },
        { id: "i",  label: "Input N",      shape: "io",       x: 160, y: 90,  w: 110, h: 36 },
        { id: "d",  label: "N mod 2 = 0?", shape: "decision", x: 160, y: 165, w: 130, h: 50 },
        { id: "pE", label: "Print 'Even'", shape: "process",  x: 50,  y: 265, w: 110, h: 36 },
        { id: "pO", label: "Print 'Odd'",  shape: "process",  x: 260, y: 265, w: 110, h: 36 },
        { id: "e",  label: "Stop",         shape: "terminal", x: 160, y: 350, w: 110, h: 36 }
      ],
      edges: [
        { from: "s",  to: "i" },
        { from: "i",  to: "d" },
        { from: "d",  to: "pE", label: "Yes" },
        { from: "d",  to: "pO", label: "No" },
        { from: "pE", to: "e" },
        { from: "pO", to: "e" }
      ]
    }
  },
  {
    title: "Factorial of a Number",
    pythonTitle: "Factorial",
    category: "Math",
    description: "Compute N! = 1 × 2 × 3 × … × N using a loop.",
    steps: [
      "Start",
      "Input N",
      "Set F = 1, i = 1",
      "While i <= N: F = F × i, i = i + 1",
      "Print F",
      "Stop"
    ],
    flowchart: {
      nodes: [
        { id: "s",  label: "Start",         shape: "terminal", x: 160, y: 20,  w: 110, h: 36 },
        { id: "i",  label: "Input N",       shape: "io",       x: 160, y: 90,  w: 110, h: 36 },
        { id: "in", label: "F=1, i=1",      shape: "process",  x: 160, y: 160, w: 110, h: 36 },
        { id: "d",  label: "i ≤ N ?",       shape: "decision", x: 160, y: 235, w: 110, h: 50 },
        { id: "b",  label: "F = F × i\ni = i + 1", shape: "process", x: 160, y: 335, w: 120, h: 44 },
        { id: "p",  label: "Print F",       shape: "io",       x: 300, y: 248, w: 110, h: 36 },
        { id: "e",  label: "Stop",          shape: "terminal", x: 300, y: 335, w: 110, h: 36 }
      ],
      edges: [
        { from: "s",  to: "i" },
        { from: "i",  to: "in" },
        { from: "in", to: "d" },
        { from: "d",  to: "b", label: "Yes" },
        { from: "d",  to: "p", label: "No" },
        { from: "b",  to: "d" },
        { from: "p",  to: "e" }
      ]
    }
  },
  {
    title: "Fibonacci Series",
    pythonTitle: "Fibonacci Series",
    category: "Math",
    description: "Generate Fibonacci numbers up to N terms: 0, 1, 1, 2, 3, 5, …",
    steps: [
      "Start",
      "Input N (number of terms)",
      "Set a = 0, b = 1, count = 0",
      "While count < N: print a, then a,b = b, a+b, count = count+1",
      "Stop"
    ],
    flowchart: {
      nodes: [
        { id: "s",  label: "Start",             shape: "terminal", x: 180, y: 20,  w: 110, h: 36 },
        { id: "i",  label: "Input N",           shape: "io",       x: 180, y: 90,  w: 110, h: 36 },
        { id: "in", label: "a=0, b=1, c=0",    shape: "process",  x: 180, y: 160, w: 130, h: 36 },
        { id: "d",  label: "c < N ?",           shape: "decision", x: 180, y: 235, w: 110, h: 50 },
        { id: "pr", label: "Print a",           shape: "io",       x: 180, y: 335, w: 110, h: 36 },
        { id: "u",  label: "a,b = b,a+b\nc = c+1", shape: "process", x: 180, y: 410, w: 130, h: 44 },
        { id: "e",  label: "Stop",              shape: "terminal", x: 340, y: 248, w: 110, h: 36 }
      ],
      edges: [
        { from: "s",  to: "i" },
        { from: "i",  to: "in" },
        { from: "in", to: "d" },
        { from: "d",  to: "pr", label: "Yes" },
        { from: "d",  to: "e",  label: "No" },
        { from: "pr", to: "u" },
        { from: "u",  to: "d" }
      ]
    }
  },
  {
    title: "Bubble Sort",
    pythonTitle: "Bubble Sort",
    category: "Sorting",
    description: "Repeatedly swap adjacent elements if they are in the wrong order.",
    steps: [
      "Start",
      "Input list of N numbers",
      "For i from 0 to N-2:",
      "  For j from 0 to N-i-2:",
      "    If list[j] > list[j+1], swap them",
      "Print sorted list",
      "Stop"
    ],
    flowchart: {
      nodes: [
        { id: "s",  label: "Start",           shape: "terminal", x: 180, y: 20,  w: 110, h: 36 },
        { id: "i",  label: "Input list, N",   shape: "io",       x: 180, y: 90,  w: 120, h: 36 },
        { id: "i1", label: "i = 0",           shape: "process",  x: 180, y: 160, w: 110, h: 36 },
        { id: "d1", label: "i < N-1 ?",       shape: "decision", x: 180, y: 230, w: 110, h: 50 },
        { id: "i2", label: "j = 0",           shape: "process",  x: 180, y: 325, w: 110, h: 36 },
        { id: "d2", label: "j < N-i-1?",      shape: "decision", x: 180, y: 400, w: 120, h: 50 },
        { id: "dc", label: "list[j] > list[j+1]?", shape: "decision", x: 180, y: 495, w: 155, h: 50 },
        { id: "sw", label: "Swap list[j] and list[j+1]", shape: "process", x: 50, y: 580, w: 155, h: 36 },
        { id: "ji", label: "j = j + 1",       shape: "process",  x: 350, y: 495, w: 100, h: 36 },
        { id: "ii", label: "i = i + 1",       shape: "process",  x: 350, y: 325, w: 100, h: 36 },
        { id: "pr", label: "Print sorted list", shape: "io",     x: 350, y: 230, w: 130, h: 36 },
        { id: "e",  label: "Stop",            shape: "terminal", x: 180, y: 680, w: 110, h: 36 }
      ],
      edges: [
        { from: "s",  to: "i" },
        { from: "i",  to: "i1" },
        { from: "i1", to: "d1" },
        { from: "d1", to: "i2",  label: "Yes" },
        { from: "d1", to: "pr",  label: "No" },
        { from: "pr", to: "e" },
        { from: "i2", to: "d2" },
        { from: "d2", to: "dc",  label: "Yes" },
        { from: "d2", to: "ii",  label: "No" },
        { from: "dc", to: "sw",  label: "Yes" },
        { from: "dc", to: "ji",  label: "No" },
        { from: "sw", to: "ji" },
        { from: "ji", to: "d2" },
        { from: "ii", to: "d1" }
      ]
    }
  },
  {
    title: "Linear Search",
    pythonTitle: "Linear Search",
    category: "Searching",
    description: "Scan each element one by one until the target is found.",
    steps: [
      "Start",
      "Input list and target value T",
      "Set i = 0, found = False",
      "While i < N and not found:",
      "  If list[i] = T: print index i, found = True",
      "  Else i = i + 1",
      "If not found: print 'Not Found'",
      "Stop"
    ],
    flowchart: {
      nodes: [
        { id: "s",  label: "Start",             shape: "terminal", x: 180, y: 20,  w: 110, h: 36 },
        { id: "i",  label: "Input list, T",     shape: "io",       x: 180, y: 90,  w: 120, h: 36 },
        { id: "in", label: "i = 0",             shape: "process",  x: 180, y: 160, w: 110, h: 36 },
        { id: "d1", label: "i < N ?",           shape: "decision", x: 180, y: 230, w: 110, h: 50 },
        { id: "d2", label: "list[i] = T ?",     shape: "decision", x: 180, y: 330, w: 130, h: 50 },
        { id: "pf", label: "Print index i\n(Found)", shape: "io", x: 50,  y: 435, w: 130, h: 44 },
        { id: "ii", label: "i = i + 1",         shape: "process",  x: 320, y: 330, w: 110, h: 36 },
        { id: "pn", label: "Print 'Not Found'", shape: "io",       x: 320, y: 230, w: 130, h: 36 },
        { id: "e",  label: "Stop",              shape: "terminal", x: 180, y: 530, w: 110, h: 36 }
      ],
      edges: [
        { from: "s",  to: "i" },
        { from: "i",  to: "in" },
        { from: "in", to: "d1" },
        { from: "d1", to: "d2",  label: "Yes" },
        { from: "d1", to: "pn",  label: "No" },
        { from: "d2", to: "pf",  label: "Yes" },
        { from: "d2", to: "ii",  label: "No" },
        { from: "ii", to: "d1" },
        { from: "pf", to: "e" },
        { from: "pn", to: "e" }
      ]
    }
  },
  {
    title: "Count Vowels in a String",
    pythonTitle: "Count Vowels",
    category: "String",
    description: "Iterate over each character and count a, e, i, o, u.",
    steps: [
      "Start",
      "Input string S",
      "Set count = 0",
      "For each character ch in S:",
      "  If ch is a vowel (a,e,i,o,u): count = count + 1",
      "Print count",
      "Stop"
    ],
    flowchart: {
      nodes: [
        { id: "s",  label: "Start",           shape: "terminal", x: 180, y: 20,  w: 110, h: 36 },
        { id: "i",  label: "Input S",         shape: "io",       x: 180, y: 90,  w: 110, h: 36 },
        { id: "in", label: "count = 0, i = 0", shape: "process", x: 180, y: 160, w: 130, h: 36 },
        { id: "d1", label: "i < len(S)?",     shape: "decision", x: 180, y: 235, w: 120, h: 50 },
        { id: "d2", label: "S[i] is vowel?",  shape: "decision", x: 180, y: 335, w: 130, h: 50 },
        { id: "cv", label: "count = count+1", shape: "process",  x: 50,  y: 435, w: 130, h: 36 },
        { id: "ii", label: "i = i + 1",       shape: "process",  x: 180, y: 435, w: 110, h: 36 },
        { id: "pr", label: "Print count",     shape: "io",       x: 330, y: 248, w: 110, h: 36 },
        { id: "e",  label: "Stop",            shape: "terminal", x: 330, y: 335, w: 110, h: 36 }
      ],
      edges: [
        { from: "s",  to: "i" },
        { from: "i",  to: "in" },
        { from: "in", to: "d1" },
        { from: "d1", to: "d2",  label: "Yes" },
        { from: "d1", to: "pr",  label: "No" },
        { from: "d2", to: "cv",  label: "Yes" },
        { from: "d2", to: "ii",  label: "No" },
        { from: "cv", to: "ii" },
        { from: "ii", to: "d1" },
        { from: "pr", to: "e" }
      ]
    }
  },
  {
    title: "Print Multiplication Table",
    pythonTitle: "Multiplication Table",
    category: "Math",
    description: "Display the multiplication table of a given number N from 1 to 10.",
    steps: [
      "Start",
      "Input N",
      "Set i = 1",
      "While i <= 10: Print N × i = result, i = i + 1",
      "Stop"
    ],
    flowchart: {
      nodes: [
        { id: "s",  label: "Start",           shape: "terminal", x: 160, y: 20,  w: 110, h: 36 },
        { id: "i",  label: "Input N",         shape: "io",       x: 160, y: 90,  w: 110, h: 36 },
        { id: "in", label: "i = 1",           shape: "process",  x: 160, y: 160, w: 110, h: 36 },
        { id: "d",  label: "i ≤ 10 ?",        shape: "decision", x: 160, y: 235, w: 110, h: 50 },
        { id: "pr", label: "Print N×i",       shape: "io",       x: 160, y: 335, w: 110, h: 36 },
        { id: "ii", label: "i = i + 1",       shape: "process",  x: 160, y: 410, w: 110, h: 36 },
        { id: "e",  label: "Stop",            shape: "terminal", x: 310, y: 248, w: 110, h: 36 }
      ],
      edges: [
        { from: "s",  to: "i" },
        { from: "i",  to: "in" },
        { from: "in", to: "d" },
        { from: "d",  to: "pr", label: "Yes" },
        { from: "d",  to: "e",  label: "No" },
        { from: "pr", to: "ii" },
        { from: "ii", to: "d" }
      ]
    }
  },
  {
    title: "Print Star Pattern (Right Triangle)",
    pythonTitle: "Star Pattern",
    category: "Pattern",
    description: "Print a right-angle triangle of stars using nested loops.",
    steps: [
      "Start",
      "Input number of rows N",
      "For i from 1 to N:",
      "  For j from 1 to i: print '*'",
      "  Move to next line",
      "Stop"
    ],
    flowchart: {
      nodes: [
        { id: "s",  label: "Start",        shape: "terminal", x: 180, y: 20,  w: 110, h: 36 },
        { id: "i",  label: "Input N",      shape: "io",       x: 180, y: 90,  w: 110, h: 36 },
        { id: "i1", label: "i = 1",        shape: "process",  x: 180, y: 160, w: 110, h: 36 },
        { id: "d1", label: "i ≤ N ?",      shape: "decision", x: 180, y: 230, w: 110, h: 50 },
        { id: "i2", label: "j = 1",        shape: "process",  x: 180, y: 325, w: 110, h: 36 },
        { id: "d2", label: "j ≤ i ?",      shape: "decision", x: 180, y: 400, w: 110, h: 50 },
        { id: "ps", label: "Print '*'",    shape: "io",       x: 180, y: 495, w: 110, h: 36 },
        { id: "ji", label: "j = j + 1",    shape: "process",  x: 320, y: 400, w: 110, h: 36 },
        { id: "nl", label: "New line",     shape: "process",  x: 40,  y: 400, w: 110, h: 36 },
        { id: "ii", label: "i = i + 1",    shape: "process",  x: 340, y: 230, w: 110, h: 36 },
        { id: "e",  label: "Stop",         shape: "terminal", x: 340, y: 160, w: 110, h: 36 }
      ],
      edges: [
        { from: "s",  to: "i" },
        { from: "i",  to: "i1" },
        { from: "i1", to: "d1" },
        { from: "d1", to: "i2",  label: "Yes" },
        { from: "d1", to: "e",   label: "No" },
        { from: "i2", to: "d2" },
        { from: "d2", to: "ps",  label: "Yes" },
        { from: "d2", to: "nl",  label: "No" },
        { from: "ps", to: "ji" },
        { from: "ji", to: "d2" },
        { from: "nl", to: "ii" },
        { from: "ii", to: "d1" }
      ]
    }
  },
  {
    title: "Check Prime Number",
    pythonTitle: "Prime Number Check",
    category: "Math",
    description: "Test if a number N is prime by trial division up to √N.",
    steps: [
      "Start",
      "Input N",
      "If N < 2: print 'Not Prime', Stop",
      "Set i = 2",
      "While i × i ≤ N:",
      "  If N mod i = 0: print 'Not Prime', Stop",
      "  i = i + 1",
      "Print 'Prime'",
      "Stop"
    ],
    flowchart: {
      nodes: [
        { id: "s",  label: "Start",        shape: "terminal", x: 180, y: 20,  w: 110, h: 36 },
        { id: "i",  label: "Input N",      shape: "io",       x: 180, y: 90,  w: 110, h: 36 },
        { id: "d0", label: "N < 2 ?",      shape: "decision", x: 180, y: 160, w: 110, h: 50 },
        { id: "pn1",label: "Print 'Not Prime'", shape: "io", x: 350, y: 160, w: 130, h: 36 },
        { id: "in", label: "i = 2",        shape: "process",  x: 180, y: 265, w: 110, h: 36 },
        { id: "d1", label: "i×i ≤ N ?",    shape: "decision", x: 180, y: 335, w: 110, h: 50 },
        { id: "d2", label: "N mod i = 0?", shape: "decision", x: 180, y: 435, w: 130, h: 50 },
        { id: "pn2",label: "Print 'Not Prime'", shape: "io", x: 50,  y: 535, w: 130, h: 36 },
        { id: "ii", label: "i = i + 1",    shape: "process",  x: 340, y: 435, w: 110, h: 36 },
        { id: "pp", label: "Print 'Prime'",shape: "io",       x: 340, y: 335, w: 110, h: 36 },
        { id: "e",  label: "Stop",         shape: "terminal", x: 180, y: 620, w: 110, h: 36 }
      ],
      edges: [
        { from: "s",  to: "i" },
        { from: "i",  to: "d0" },
        { from: "d0", to: "pn1", label: "Yes" },
        { from: "d0", to: "in",  label: "No" },
        { from: "pn1",to: "e" },
        { from: "in", to: "d1" },
        { from: "d1", to: "d2",  label: "Yes" },
        { from: "d1", to: "pp",  label: "No" },
        { from: "d2", to: "pn2", label: "Yes" },
        { from: "d2", to: "ii",  label: "No" },
        { from: "ii", to: "d1" },
        { from: "pp", to: "e" },
        { from: "pn2",to: "e" }
      ]
    }
  },
  {
    title: "Reverse a String",
    pythonTitle: "Reverse a String",
    category: "String",
    description: "Traverse a string from the last character to the first.",
    steps: [
      "Start",
      "Input string S",
      "Set result = ''",
      "For i from len(S)-1 down to 0:",
      "  result = result + S[i]",
      "Print result",
      "Stop"
    ],
    flowchart: {
      nodes: [
        { id: "s",  label: "Start",           shape: "terminal", x: 180, y: 20,  w: 110, h: 36 },
        { id: "i",  label: "Input S",         shape: "io",       x: 180, y: 90,  w: 110, h: 36 },
        { id: "in", label: "result='', i=len(S)-1", shape: "process", x: 180, y: 160, w: 160, h: 36 },
        { id: "d",  label: "i ≥ 0 ?",         shape: "decision", x: 180, y: 240, w: 110, h: 50 },
        { id: "b",  label: "result = result + S[i]\ni = i - 1", shape: "process", x: 180, y: 340, w: 160, h: 44 },
        { id: "pr", label: "Print result",    shape: "io",       x: 360, y: 253, w: 110, h: 36 },
        { id: "e",  label: "Stop",            shape: "terminal", x: 360, y: 340, w: 110, h: 36 }
      ],
      edges: [
        { from: "s",  to: "i" },
        { from: "i",  to: "in" },
        { from: "in", to: "d" },
        { from: "d",  to: "b",  label: "Yes" },
        { from: "d",  to: "pr", label: "No" },
        { from: "b",  to: "d" },
        { from: "pr", to: "e" }
      ]
    }
  }
];

/* =====================================================
   SVG FLOWCHART RENDERER
   ===================================================== */

const SHAPE_COLORS = {
  terminal:  { fill: "#16213e", stroke: "#16213e", text: "#ffffff" },
  process:   { fill: "#ffffff", stroke: "#16213e", text: "#1c1c1c" },
  decision:  { fill: "#fff8f0", stroke: "#e8834e", text: "#1c1c1c" },
  io:        { fill: "#f0f7ff", stroke: "#3b82f6", text: "#1c1c1c" }
};

function nodeCentre(node) {
  return { cx: node.x + node.w / 2, cy: node.y + node.h / 2 };
}

function buildNodeMap(nodes) {
  const m = {};
  nodes.forEach(n => { m[n.id] = n; });
  return m;
}

function shapePath(node) {
  const { x, y, w, h, shape } = node;
  if (shape === "terminal") {
    const r = h / 2;
    return `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
  }
  if (shape === "decision") {
    const mx = x + w / 2, my = y + h / 2;
    return `M${mx},${y} L${x + w},${my} L${mx},${y + h} L${x},${my} Z`;
  }
  if (shape === "io") {
    const skew = 10;
    return `M${x + skew},${y} H${x + w} L${x + w - skew},${y + h} H${x} Z`;
  }
  // process — plain rectangle
  return `M${x},${y} H${x + w} V${y + h} H${x} Z`;
}

function edgePath(fromNode, toNode, nodeMap, edges) {
  const f = { cx: fromNode.x + fromNode.w / 2, cy: fromNode.y + fromNode.h / 2 };
  const t = { cx: toNode.x + toNode.w / 2,   cy: toNode.y + toNode.h / 2 };

  // Choose exit/entry points based on relative position
  let x1, y1, x2, y2;
  const dy = t.cy - f.cy;
  const dx = t.cx - f.cx;

  if (Math.abs(dy) >= Math.abs(dx)) {
    // Mostly vertical
    if (dy > 0) {
      x1 = f.cx; y1 = fromNode.y + fromNode.h;
      x2 = t.cx; y2 = toNode.y;
    } else {
      x1 = f.cx; y1 = fromNode.y;
      x2 = t.cx; y2 = toNode.y + toNode.h;
    }
  } else {
    // Mostly horizontal
    if (dx > 0) {
      x1 = fromNode.x + fromNode.w; y1 = f.cy;
      x2 = toNode.x;               y2 = t.cy;
    } else {
      x1 = fromNode.x; y1 = f.cy;
      x2 = toNode.x + toNode.w; y2 = t.cy;
    }
  }

  // Simple elbow: go halfway vertically first
  const my = (y1 + y2) / 2;
  return `M${x1},${y1} L${x1},${my} L${x2},${my} L${x2},${y2}`;
}

function computeSVGBounds(nodes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(n => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w);
    maxY = Math.max(maxY, n.y + n.h);
  });
  return { minX, minY, maxX, maxY };
}

function renderFlowchartSVG(flowchart, titleText) {
  const { nodes, edges } = flowchart;
  const nodeMap = buildNodeMap(nodes);
  const PAD = 32;
  const bounds = computeSVGBounds(nodes);
  const W = bounds.maxX - bounds.minX + PAD * 2;
  const H = bounds.maxY - bounds.minY + PAD * 2;
  const ox = PAD - bounds.minX;  // offset x so all coords start at PAD
  const oy = PAD - bounds.minY;

  let edgeSVG = "";
  edges.forEach(edge => {
    const fn = nodeMap[edge.from];
    const tn = nodeMap[edge.to];
    if (!fn || !tn) return;

    // Offset all coords
    const fOff = { ...fn, x: fn.x + ox, y: fn.y + oy };
    const tOff = { ...tn, x: tn.x + ox, y: tn.y + oy };

    const d = edgePath(fOff, tOff, nodeMap, edges);
    edgeSVG += `<path d="${d}" fill="none" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arrow)"/>`;

    if (edge.label) {
      // Label mid-point
      const f = { cx: fOff.x + fOff.w / 2, cy: fOff.y + fOff.h / 2 };
      const t = { cx: tOff.x + tOff.w / 2, cy: tOff.y + tOff.h / 2 };
      const lx = (f.cx + t.cx) / 2;
      const ly = (f.cy + t.cy) / 2;
      edgeSVG += `<text x="${lx}" y="${ly - 4}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="10" fill="#e8834e" font-weight="600">${edge.label}</text>`;
    }
  });

  let nodeSVG = "";
  nodes.forEach(node => {
    const nx = node.x + ox;
    const ny = node.y + oy;
    const nw = node.w;
    const nh = node.h;
    const nShifted = { ...node, x: nx, y: ny };
    const col = SHAPE_COLORS[node.shape] || SHAPE_COLORS.process;
    const path = shapePath(nShifted);
    nodeSVG += `<path d="${path}" fill="${col.fill}" stroke="${col.stroke}" stroke-width="1.8"/>`;

    // Multi-line label support
    const lines = node.label.split("\n");
    const lineH = 13;
    const textY = ny + nh / 2 - (lines.length - 1) * lineH / 2;
    lines.forEach((line, li) => {
      nodeSVG += `<text x="${nx + nw / 2}" y="${textY + li * lineH}" text-anchor="middle" dominant-baseline="middle" font-family="Inter,system-ui,sans-serif" font-size="11" font-weight="500" fill="${col.text}">${escapeXml(line)}</text>`;
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Flowchart for ${escapeXml(titleText)}">
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 Z" fill="#94a3b8"/>
    </marker>
  </defs>
  ${edgeSVG}
  ${nodeSVG}
</svg>`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* =====================================================
   ICONS PER CATEGORY
   ===================================================== */
const CAT_ICONS = {
  Basics: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  Math:   `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><line x1="12" y1="5" x2="12" y2="19"/></svg>`,
  Sorting:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="8" y2="18"/></svg>`,
  Searching:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  String: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
  Pattern:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="4" height="4"/><rect x="10" y="3" width="4" height="4"/><rect x="3" y="10" width="4" height="4"/></svg>`
};

function iconForCat(cat) {
  return CAT_ICONS[cat] || CAT_ICONS["Basics"];
}

/* =====================================================
   RENDER CARDS
   ===================================================== */
function buildCard(algo) {
  const pythonSlug = slugify(algo.pythonTitle || algo.title);
  const stepsHTML = algo.steps.map(s => `<li>${escapeXml(s)}</li>`).join("");

  const card = document.createElement("article");
  card.className = "algo-card";
  card.dataset.cat = algo.category;
  card.dataset.title = (algo.title + " " + algo.category + " " + algo.steps.join(" ")).toLowerCase();

  card.innerHTML = `
    <div class="algo-card-header">
      <div class="algo-card-icon">${iconForCat(algo.category)}</div>
      <div class="algo-card-meta">
        <div class="algo-card-title">${escapeXml(algo.title)}</div>
        <div class="algo-card-cat">${escapeXml(algo.category)}</div>
      </div>
    </div>
    <div class="algo-steps">
      <div class="algo-steps-title">Algorithm</div>
      <ol>${stepsHTML}</ol>
    </div>
    <div class="algo-card-footer">
      <button class="btn-flowchart" data-algo-idx="${ALGORITHMS.indexOf(algo)}" title="View Flowchart">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><line x1="6" y1="9" x2="6" y2="12"/><line x1="18" y1="9" x2="18" y2="12"/><line x1="6" y1="12" x2="12" y2="12"/><line x1="18" y1="12" x2="12" y2="12"/><line x1="12" y1="12" x2="12" y2="15"/></svg>
        View Flowchart
      </button>
      <a class="btn-python-hub" href="python.html#${pythonSlug}" title="Open in Python Hub">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12 2c-2.7 0-4.9.4-6.3 1.2-1.9 1-2.1 2.3-2.1 4.5v2.8h8.5v1.1H4.3C2 11.6.4 13.3.4 16.3c0 3 1.9 4.8 4.7 4.8h2.3v-2.8c0-1.8 1.6-3.4 3.4-3.4h5.6c1.5 0 2.8-1.2 2.8-2.8V6.4c0-2.2-1.8-3.9-4.2-4.2C13.8 2.1 12.9 2 12 2zm-2.5 2.1c.6 0 1.1.5 1.1 1.1 0 .6-.5 1.1-1.1 1.1s-1.1-.5-1.1-1.1c0-.6.5-1.1 1.1-1.1z"/></svg>
        See in Python Hub
      </a>
    </div>`;

  return card;
}

/* =====================================================
   FILTER + SEARCH
   ===================================================== */
let activeCategory = "all";

function getFilteredAlgos() {
  const q = (document.getElementById("algoSearch").value || "").trim().toLowerCase();
  return ALGORITHMS.filter(a => {
    const catMatch = activeCategory === "all" || a.category === activeCategory;
    const textMatch = !q || (a.title + " " + a.category + " " + a.steps.join(" ")).toLowerCase().includes(q);
    return catMatch && textMatch;
  });
}

function renderGrid() {
  const grid = document.getElementById("algoGrid");
  const empty = document.getElementById("algoEmpty");
  const algos = getFilteredAlgos();
  grid.innerHTML = "";
  if (!algos.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  algos.forEach(a => grid.appendChild(buildCard(a)));
}

// Filter chips
document.getElementById("filterChips").addEventListener("click", e => {
  const chip = e.target.closest(".filter-chip");
  if (!chip) return;
  document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
  chip.classList.add("active");
  activeCategory = chip.dataset.cat;
  renderGrid();
});

// Search
document.getElementById("algoSearch").addEventListener("input", renderGrid);

/* =====================================================
   FLOWCHART MODAL
   ===================================================== */
const modal = document.getElementById("flowchartModal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalPythonLink = document.getElementById("modalPythonLink");
const modalClose = document.getElementById("modalClose");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalBackdrop = document.getElementById("modalBackdrop");

function openModal(algo) {
  modalTitle.textContent = algo.title + " — Flowchart";
  modalBody.innerHTML = renderFlowchartSVG(algo.flowchart, algo.title);
  const slug = slugify(algo.pythonTitle || algo.title);
  modalPythonLink.href = "python.html#" + slug;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  modalClose.focus();
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
}

modalClose.addEventListener("click", closeModal);
modalCloseBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !modal.hidden) closeModal();
});

// Delegate flowchart button clicks inside the grid
document.getElementById("algoGrid").addEventListener("click", e => {
  const btn = e.target.closest(".btn-flowchart");
  if (!btn) return;
  const idx = parseInt(btn.dataset.algoIdx, 10);
  if (!isNaN(idx) && ALGORITHMS[idx]) openModal(ALGORITHMS[idx]);
});

/* =====================================================
   INIT
   ===================================================== */
renderGrid();
