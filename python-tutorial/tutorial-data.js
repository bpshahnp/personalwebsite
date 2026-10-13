/* ==========================================================================
   Python Tutorial — Nepal Curriculum Edition (Grades 4-10 & +2)
   Curated Course Data & Curriculum Outline
   ========================================================================== */

const TUTORIAL_DATA = {
  grades: [
    {
      id: "grade4",
      num: 4,
      title: "Grade 4",
      badge: "Beginner",
      desc: "Fun start to coding: concepts, algorithms, and first Python words",
      modules: [
        {
          id: "g4-m1",
          title: "1. What is Coding & Computer?",
          lessons: [
            {
              id: "g4-l1",
              title: "What is a Computer Program?",
              desc: "Computers need instructions step by step, just like a recipe or school morning routine.",
              content: `
                <h3>What is a Computer Program?</h3>
                <p>Welcome to the world of coding! A <strong>computer program</strong> is simply a set of step-by-step instructions given to a computer so it knows what to do.</p>
                <div class="callout tip">
                  <strong>Analogy:</strong> Think of a recipe for making Nepali Chiya (tea):
                  <ol>
                    <li>Boil water and milk in a pan.</li>
                    <li>Add tea leaves and sugar.</li>
                    <li>Simmer for 2 minutes.</li>
                    <li>Strain and serve hot!</li>
                  </ol>
                  If you change the order (like straining before boiling), it won't work! Computer programs are exact step-by-step recipes.
                </div>
                <h3>Why Python?</h3>
                <p><strong>Python</strong> is one of the world's most popular programming languages. It was designed to look like normal everyday English sentences so young learners can easily understand and write it.</p>
              `,
              code: `# Your very first line of Python code!
# B. Prasad Shah Educational Suite — Python Tutorial
print("Namaste Nepal! Welcome to Coding.")
print("Learning Python with B. Prasad Shah.")
`,
              output: `Namaste Nepal! Welcome to Coding.
Learning Python with B. Prasad Shah.`
            },
            {
              id: "g4-l2",
              title: "The print() Magic Wand",
              desc: "Learn how Python talks to the screen using the print() function.",
              content: `
                <h3>The print() Function</h3>
                <p>In Python, <code>print()</code> is like a loudspeaker. Whatever you put inside the quotation marks <code>"..."</code> inside the brackets gets shown on the screen.</p>
                <p>You can print text, numbers, greetings, and even cool ASCII art shapes!</p>
              `,
              code: `# Printing text and numbers
print("Kathmandu is the capital of Nepal.")
print(2026)
print("I love learning Python!")
`,
              output: `Kathmandu is the capital of Nepal.
2026
I love learning Python!`
            },
            {
              id: "g4-l3",
              title: "Drawing with Code (ASCII Art)",
              desc: "Use multiple print statements to draw mountains, houses, and smiley faces.",
              content: `
                <h3>Drawing Pictures with Characters</h3>
                <p>Before advanced graphics, early coders used characters like slashes, stars, and dashes to draw pictures. Let's draw Mount Everest using Python!</p>
              `,
              code: `# Drawing Mount Everest with print()
print("      /\\")
print("     /  \\")
print("    / /\\ \\")
print("   / /  \\ \\")
print("  /_/____\\_\\")
print(" Mount Everest (Sagarmatha)")
`,
              output: `      /\\
     /  \\
    / /\\ \\
   / /  \\ \\
  /_/____\\_\\
 Mount Everest (Sagarmatha)`
            }
          ]
        },
        {
          id: "g4-m2",
          title: "2. Working with Numbers & Math",
          lessons: [
            {
              id: "g4-l4",
              title: "Python as a Calculator",
              desc: "Perform addition, subtraction, multiplication, and division effortlessly.",
              content: `
                <h3>Basic Math Operators in Python</h3>
                <p>Notice that numbers don't need quotation marks <code>"..."</code>! If you put quotes around <code>"5 + 3"</code>, Python prints the text. Without quotes, Python actually calculates the answer!</p>
                <ul>
                  <li><code>+</code> : Addition</li>
                  <li><code>-</code> : Subtraction</li>
                  <li><code>*</code> : Multiplication (asterisk)</li>
                  <li><code>/</code> : Division (forward slash)</li>
                </ul>
              `,
              code: `# Python doing school arithmetic
print("5 + 3 =", 5 + 3)
print("10 - 4 =", 10 - 4)
print("6 * 7 =", 6 * 7)
print("20 / 4 =", 20 / 4)
`,
              output: `5 + 3 = 8
10 - 4 = 6
6 * 7 = 42
20 / 4 = 5.0`
            }
          ]
        }
      ]
    },
    {
      id: "grade5",
      num: 5,
      title: "Grade 5",
      badge: "Explorer",
      desc: "Variables, user interaction, strings, and simple decision making",
      modules: [
        {
          id: "g5-m1",
          title: "1. Variables & Data Storage",
          lessons: [
            {
              id: "g5-l1",
              title: "What is a Variable?",
              desc: "Think of a variable as a labeled storage box that holds information.",
              content: `
                <h3>Variables: Storage Boxes</h3>
                <p>In Grade 5, we learn how computers remember values. A <strong>variable</strong> has a name and a value stored inside it using the <code>=</code> (assignment) operator.</p>
                <div class="callout tip">
                  <strong>Rules for Naming Variables:</strong>
                  <ul>
                    <li>Use descriptive names: <code>student_name</code>, <code>score</code>, <code>city</code>.</li>
                    <li>Cannot start with a number.</li>
                    <li>No spaces allowed (use underscores like <code>my_age</code>).</li>
                  </ul>
                </div>
              `,
              code: `# Creating and using variables
student_name = "Aarav"
grade = 5
school = "Kathmandu Valley School"

print("Student Name:", student_name)
print("Class:", grade)
print("School:", school)
`,
              output: `Student Name: Aarav
Class: 5
School: Kathmandu Valley School`
            },
            {
              id: "g5-l2",
              title: "Taking Input from the User",
              desc: "Make your program interactive using input() function.",
              content: `
                <h3>The input() Function</h3>
                <p>Programs are much more exciting when they ask the user for information! The <code>input()</code> function pauses and waits for someone to type an answer.</p>
              `,
              code: `# Interactive Greeting Program
name = input("Enter your name: ")
favorite_subject = input("Enter your favorite subject: ")

print("Hello", name + "!")
print("It is awesome that you love", favorite_subject)
`,
              output: `Enter your name: Bipul
Enter your favorite subject: Computer Science
Hello Bipul!
It is awesome that you love Computer Science`
            }
          ]
        },
        {
          id: "g5-m2",
          title: "2. Simple Decision Making (if-else)",
          lessons: [
            {
              id: "g5-l3",
              title: "The if Statement: Making Choices",
              desc: "Teach your program to choose between two paths depending on a condition.",
              content: `
                <h3>If and Else Conditions</h3>
                <p>Computers can make decisions! For example: <em>If it rains, take an umbrella. Else, wear sunglasses.</em></p>
                <p>In Python, notice the colon <code>:</code> at the end of the line and the <strong>indentation</strong> (spaces) before the code inside.</p>
              `,
              code: `# Checking age for roller coaster ride
age = int(input("Enter your age: "))

if age >= 10:
    print("Hurray! You can ride the roller coaster.")
else:
    print("Sorry, you must be at least 10 years old.")
`,
              output: `Enter your age: 11
Hurray! You can ride the roller coaster.`
            }
          ]
        }
      ]
    },
    {
      id: "grade6",
      num: 6,
      title: "Grade 6",
      badge: "Foundations",
      desc: "CDC Class 6 Syllabus: Data types, operators, flowcharts to code, loops",
      modules: [
        {
          id: "g6-m1",
          title: "1. Python Data Types & Operators",
          lessons: [
            {
              id: "g6-l1",
              title: "Integers, Floats, and Strings",
              desc: "Understand numeric types and string data types defined by CDC curriculum.",
              content: `
                <h3>Python Data Types in Grade 6</h3>
                <p>Every piece of data has a specific category called a <strong>data type</strong>:</p>
                <ul>
                  <li><code>int</code>: Whole numbers (e.g., <code>10</code>, <code>-5</code>, <code>100</code>).</li>
                  <li><code>float</code>: Decimal numbers (e.g., <code>3.14</code>, <code>98.5</code>).</li>
                  <li><code>str</code>: Text characters enclosed in quotes (e.g., <code>"Pokhara"</code>).</li>
                  <li><code>bool</code>: True or False boolean values.</li>
                </ul>
              `,
              code: `# Checking types in Python
x = 25
price = 99.50
city = "Lalitpur"
is_nepali = True

print(type(x))
print(type(price))
print(type(city))
print(type(is_nepali))
`,
              output: `<class 'int'>
<class 'float'>
<class 'str'>
<class 'bool'>`
            },
            {
              id: "g6-l2",
              title: "Type Casting: Converting Input",
              desc: "Convert text from input() into numbers using int() and float().",
              content: `
                <h3>Why Type Casting is Necessary</h3>
                <p>When you use <code>input()</code>, Python always stores it as a text string! If you enter <code>10</code> and <code>20</code>, Python will do <code>"10" + "20" = "1020"</code> instead of <code>30</code>!</p>
                <p>To fix this, wrap input with <code>int()</code> or <code>float()</code>.</p>
              `,
              code: `# Adding two numbers correctly
num1 = int(input("Enter first number: "))
num2 = int(input("Enter second number: "))

total = num1 + num2
print("The sum is:", total)
`,
              output: `Enter first number: 15
Enter second number: 25
The sum is: 40`
            }
          ]
        },
        {
          id: "g6-m2",
          title: "2. Loops: Repeating Actions",
          lessons: [
            {
              id: "g6-l3",
              title: "The for loop with range()",
              desc: "Execute a block of code multiple times without rewriting it.",
              content: `
                <h3>For Loop in Python</h3>
                <p>A loop saves you from repeating code manually. Instead of writing <code>print()</code> 10 times, you use a <code>for</code> loop with <code>range()</code>.</p>
                <p><code>range(1, 6)</code> generates numbers from 1 up to 5 (stops before 6).</p>
              `,
              code: `# Printing multiplication table of 5
number = 5
print("Multiplication Table of", number)

for i in range(1, 11):
    product = number * i
    print(number, "x", i, "=", product)
`,
              output: `Multiplication Table of 5
5 x 1 = 5
5 x 2 = 10
5 x 3 = 15
5 x 4 = 20
5 x 5 = 25
5 x 6 = 30
5 x 7 = 35
5 x 8 = 40
5 x 9 = 45
5 x 10 = 50`
            }
          ]
        }
      ]
    },
    {
      id: "grade7",
      num: 7,
      title: "Grade 7",
      badge: "Intermediate",
      desc: "Conditional branches, while loops, string manipulation, and turtle basics",
      modules: [
        {
          id: "g7-m1",
          title: "1. Multi-Way Decisions (elif ladder)",
          lessons: [
            {
              id: "g7-l1",
              title: "Grade Sheet & Division Calculator",
              desc: "Building a realistic student grade classifier using if-elif-else statements.",
              content: `
                <h3>The elif Statement</h3>
                <p>When you have more than 2 possibilities (e.g., Distinction, First Division, Second Division), Python provides <code>elif</code> (short for else-if).</p>
              `,
              code: `# Nepali School Grading System
marks = float(input("Enter your exam percentage (0-100): "))

if marks >= 90:
    grade = "A+ (Outstanding)"
elif marks >= 80:
    grade = "A (Excellent)"
elif marks >= 70:
    grade = "B+ (Very Good)"
elif marks >= 60:
    grade = "B (Good)"
elif marks >= 50:
    grade = "C+ (Satisfactory)"
elif marks >= 40:
    grade = "C (Acceptable)"
else:
    grade = "NG (Needs Improvement)"

print("Your Grade is:", grade)
`,
              output: `Enter your exam percentage (0-100): 84.5
Your Grade is: A (Excellent)`
            }
          ]
        },
        {
          id: "g7-m2",
          title: "2. The while Loop & Accumulators",
          lessons: [
            {
              id: "g7-l2",
              title: "Sum of First N Natural Numbers",
              desc: "Use while loop with a counter and accumulator variable.",
              content: `
                <h3>While Loop Concepts</h3>
                <p>A <code>while</code> loop continues running as long as its condition remains <code>True</code>. Always make sure to update the counter variable so the loop eventually terminates!</p>
              `,
              code: `# Sum of 1 to N using while loop
n = int(input("Enter N: "))
sum_total = 0
count = 1

while count <= n:
    sum_total = sum_total + count
    count = count + 1

print("Sum of numbers from 1 to", n, "is:", sum_total)
`,
              output: `Enter N: 10
Sum of numbers from 1 to 10 is: 55`
            }
          ]
        }
      ]
    },
    {
      id: "grade8",
      num: 8,
      title: "Grade 8",
      badge: "BLE Prep",
      desc: "BLE Level: Lists, Tuples, Dictionaries, Functions, and Math modules",
      modules: [
        {
          id: "g8-m1",
          title: "1. Python Lists & Sequences",
          lessons: [
            {
              id: "g8-l1",
              title: "Working with Python Lists",
              desc: "Store multiple values in a single list, append items, index, and slice.",
              content: `
                <h3>What is a List?</h3>
                <p>A list allows you to store a collection of items in order. Lists use square brackets <code>[...]</code> and items are separated by commas.</p>
                <p>Remember: Indexing in Python starts at <strong>0</strong>!</p>
              `,
              code: `# Nepali Tourist Cities List
places = ["Pokhara", "Kathmandu", "Chitwan", "Lumbini", "Mustang"]

print("First city:", places[0])
print("Last city:", places[-1])

# Adding a new city
places.append("Janakpur")
print("Total destinations:", len(places))
print("All places:", places)
`,
              output: `First city: Pokhara
Last city: Mustang
Total destinations: 6
All places: ['Pokhara', 'Kathmandu', 'Chitwan', 'Lumbini', 'Mustang', 'Janakpur']`
            }
          ]
        },
        {
          id: "g8-m2",
          title: "2. Modular Programming with Functions",
          lessons: [
            {
              id: "g8-l2",
              title: "Creating Custom Functions with def",
              desc: "Write reusable functions with parameters and return values.",
              content: `
                <h3>Functions in Python</h3>
                <p>A function is a reusable block of code that performs a specific task. We define functions with the keyword <code>def</code> followed by the function name.</p>
              `,
              code: `# Simple Interest Calculator Function
def calculate_simple_interest(principal, time_years, rate_percent):
    interest = (principal * time_years * rate_percent) / 100
    total_amount = principal + interest
    return interest, total_amount

p = 50000  # Rs. 50,000
t = 2      # 2 years
r = 10     # 10% interest rate

si, total = calculate_simple_interest(p, t, r)
print("Principal Amount: Rs.", p)
print("Interest Earned : Rs.", si)
print("Total Amount Due: Rs.", total)
`,
              output: `Principal Amount: Rs. 50000
Interest Earned : Rs. 10000.0
Total Amount Due: Rs. 60000.0`
            }
          ]
        }
      ]
    },
    {
      id: "grade9",
      num: 9,
      title: "Grade 9",
      badge: "Secondary",
      desc: "CDC Secondary Computer Science: String algorithms, dictionaries, nested loops",
      modules: [
        {
          id: "g9-m1",
          title: "1. String Methods & Algorithms",
          lessons: [
            {
              id: "g9-l1",
              title: "Palindrome Checker in Python",
              desc: "Check if a word reads the same forward and backwards (e.g. radar, madam, mom).",
              content: `
                <h3>String Slicing and Palindromes</h3>
                <p>In Grade 9, you write practical algorithms. A <strong>palindrome</strong> is a string that reads the same in reverse. In Python, reversing a string is as clean as <code>word[::-1]</code>!</p>
              `,
              code: `# Palindrome String Checker
text = input("Enter a word: ")
cleaned = text.lower().replace(" ", "")

if cleaned == cleaned[::-1]:
    print(f"'{text}' is a Palindrome!")
else:
    print(f"'{text}' is NOT a palindrome.")
`,
              output: `Enter a word: Madam
'Madam' is a Palindrome!`
            }
          ]
        },
        {
          id: "g9-m2",
          title: "2. Key-Value Mappings with Dictionaries",
          lessons: [
            {
              id: "g9-l2",
              title: "Dictionary for Student Records",
              desc: "Store structured information using key-value pairs.",
              content: `
                <h3>Dictionaries in Python</h3>
                <p>A dictionary stores data in <code>{key: value}</code> pairs. Instead of searching by index number, you access items by their meaningful key name.</p>
              `,
              code: `# Student record dictionary
student = {
    "roll_no": 12,
    "name": "Prerana Sharma",
    "grade": 9,
    "subjects": ["Math", "Science", "Computer"],
    "is_passed": True
}

print("Student:", student["name"])
print("Enrolled in:", ", ".join(student["subjects"]))

# Adding a new key
student["gpa"] = 3.85
print("Updated Profile:", student)
`,
              output: `Student: Prerana Sharma
Enrolled in: Math, Science, Computer
Updated Profile: {'roll_no': 12, 'name': 'Prerana Sharma', 'grade': 9, 'subjects': ['Math', 'Science', 'Computer'], 'is_passed': True, 'gpa': 3.85}`
            }
          ]
        }
      ]
    },
    {
      id: "grade10",
      num: 10,
      title: "Grade 10 (SEE)",
      badge: "SEE Board",
      desc: "SEE Board Pattern: File handling, search/sort algorithms, modular exam questions",
      modules: [
        {
          id: "g10-m1",
          title: "1. SEE Python Exam Algorithms",
          lessons: [
            {
              id: "g10-l1",
              title: "Prime Number & Factorial Program",
              desc: "High-frequency SEE Board practical exam problems with clean logic.",
              content: `
                <h3>Prime Number Checker</h3>
                <p>A prime number is a natural number greater than 1 that cannot be formed by multiplying two smaller natural numbers. This is one of the most frequently asked questions in computer exams.</p>
              `,
              code: `# SEE Exam Question: Prime Number Checker
num = int(input("Enter an integer: "))

if num > 1:
    is_prime = True
    for i in range(2, int(num ** 0.5) + 1):
        if num % i == 0:
            is_prime = False
            break
            
    if is_prime:
        print(f"{num} is a PRIME number.")
    else:
        print(f"{num} is a COMPOSITE number.")
else:
    print(f"{num} is neither prime nor composite.")
`,
              output: `Enter an integer: 29
29 is a PRIME number.`
            },
            {
              id: "g10-l2",
              title: "Fibonacci Series Generator",
              desc: "Generate the Fibonacci series up to N terms using clean variable swapping.",
              content: `
                <h3>Fibonacci Series</h3>
                <p>The sequence starts with <code>0, 1</code>, and each subsequent number is the sum of the two preceding ones: <code>0, 1, 1, 2, 3, 5, 8, 13...</code></p>
              `,
              code: `# Fibonacci Series generator
terms = int(input("How many terms? "))

a, b = 0, 1
count = 0

print("Fibonacci Series:")
while count < terms:
    print(a, end=" ")
    nth = a + b
    a = b
    b = nth
    count += 1
print()
`,
              output: `How many terms? 8
Fibonacci Series:
0 1 1 2 3 5 8 13 `
            }
          ]
        },
        {
          id: "g10-m2",
          title: "2. File Handling in Python",
          lessons: [
            {
              id: "g10-l3",
              title: "Reading and Writing Text Files",
              desc: "Save data permanently on the disk using open(), write(), and read().",
              content: `
                <h3>File Handling Basics</h3>
                <p>Variables disappear when a program stops. Files save data permanently on the storage drive! Python uses the <code>with open(...)</code> statement to automatically handle closing files safely.</p>
              `,
              code: `# Writing and Reading from a file in Python
filename = "see_notes.txt"

# 1. Writing to file
with open(filename, "w") as f:
    f.write("Computer Science Grade 10\\n")
    f.write("Topic: Python File Handling\\n")
    f.write("Status: Practiced successfully!\\n")

# 2. Reading back from file
with open(filename, "r") as f:
    content = f.read()

print("File Content:\\n" + content)
`,
              output: `File Content:
Computer Science Grade 10
Topic: Python File Handling
Status: Practiced successfully!`
            }
          ]
        }
      ]
    },
    {
      id: "plus2",
      num: "11-12",
      title: "+2 Level (Class 11 & 12)",
      badge: "NEB Board",
      desc: "NEB Class 11-12 Syllabus: OOP, recursion, exceptions, modules, and mini projects",
      modules: [
        {
          id: "p2-m1",
          title: "1. Object-Oriented Programming (OOP)",
          lessons: [
            {
              id: "p2-l1",
              title: "Classes, Objects, and __init__",
              desc: "Model real-world entities using OOP principles prescribed by NEB.",
              content: `
                <h3>What is OOP?</h3>
                <p>Object-Oriented Programming (OOP) models software around real-world objects that possess <strong>attributes</strong> (data) and <strong>methods</strong> (behaviors).</p>
                <ul>
                  <li><strong>Class:</strong> Blueprint or template (e.g., <code>Student</code>).</li>
                  <li><strong>Object:</strong> Concrete instance created from that blueprint.</li>
                  <li><code>__init__</code>: Constructor method called automatically when an object is created.</li>
                </ul>
              `,
              code: `# Class definition for NEB Exam
class Student:
    def __init__(self, name, roll_no, marks_list):
        self.name = name
        self.roll_no = roll_no
        self.marks_list = marks_list

    def get_average(self):
        return sum(self.marks_list) / len(self.marks_list)

    def display_info(self):
        avg = self.get_average()
        status = "PASSED" if avg >= 40 else "FAILED"
        print(f"Roll: {self.roll_no} | Name: {self.name} | Avg: {avg:.2f}% | Status: {status}")

# Creating student instances
s1 = Student("Aayush Adhikari", 101, [85, 78, 92, 88])
s2 = Student("Sunita Gurung", 102, [90, 94, 89, 96])

s1.display_info()
s2.display_info()
`,
              output: `Roll: 101 | Name: Aayush Adhikari | Avg: 85.75% | Status: PASSED
Roll: 102 | Name: Sunita Gurung | Avg: 92.25% | Status: PASSED`
            },
            {
              id: "p2-l2",
              title: "Inheritance in Python",
              desc: "Derive child classes from base parent classes to promote code reuse.",
              content: `
                <h3>Inheritance</h3>
                <p>Inheritance allows a child class to inherit attributes and methods from a parent class while adding its own specialized behavior.</p>
              `,
              code: `# Inheritance example
class Person:
    def __init__(self, name, citizen_id):
        self.name = name
        self.citizen_id = citizen_id

    def introduce(self):
        print(f"Namaste, I am {self.name}.")

class Teacher(Person):
    def __init__(self, name, citizen_id, subject):
        super().__init__(name, citizen_id)
        self.subject = subject

    def teach(self):
        print(f"I teach {self.subject} at High School.")

t = Teacher("Prof. Shah", "01-02-3456", "Computer Science")
t.introduce()
t.teach()
`,
              output: `Namaste, I am Prof. Shah.
I teach Computer Science at High School.`
            }
          ]
        },
        {
          id: "p2-m2",
          title: "2. Exception Handling & File I/O",
          lessons: [
            {
              id: "p2-l3",
              title: "Try-Except-Finally Blocks",
              desc: "Handle runtime exceptions smoothly without letting the program crash.",
              content: `
                <h3>Robust Error Handling</h3>
                <p>Real-world software must anticipate user mistakes (like entering zero or invalid numbers). The <code>try-except</code> block lets programs recover gracefully.</p>
              `,
              code: `# Safe Division with Exception Handling
def safe_division():
    try:
        a = float(input("Enter numerator: "))
        b = float(input("Enter denominator: "))
        result = a / b
        print(f"Result: {a} / {b} = {result}")
    except ZeroDivisionError:
        print("Error: Cannot divide by zero in mathematics!")
    except ValueError:
        print("Error: Invalid input. Please enter valid numbers.")
    finally:
        print("Execution completed.")

safe_division()
`,
              output: `Enter numerator: 10
Enter denominator: 0
Error: Cannot divide by zero in mathematics!
Execution completed.`
            }
          ]
        }
      ]
    }
  ]
};
