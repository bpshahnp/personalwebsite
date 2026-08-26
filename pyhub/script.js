const snippets = [
    {
    id: "d1",
    num: 1,
    title: 'Print "Hello, World!"',
    description: "Write a Python program to print \"Hello,World!\".",
    category: "Basics",
    code: `print("Hello, World!")`
  },
  {
    id: "d2",
    num: 2,
    title: "Celsius to Fahrenheit",
    description: "Write a Python program to convert a temperature from Celsius to Fahrenheit.",
    category: "Basics",
    code: `celsius = float(input("Enter temperature in Celsius: "))
fahrenheit = (celsius * 9/5) + 32
print(f"{celsius}°C is equal to {fahrenheit}°F")`
  },
  {
    id: "d3",
    num: 3,
    title: "Name and Age with f-strings",
    description: "Write a Python program using f-strings to display a person's name and age.",
    category: "Basics",
    code: `name = "Aarav"
age = 21
print(f"My name is {name} and I am {age} years old.")`
  },
  {
    id: "d4",
    num: 4,
    title: "Uppercase and Lowercase",
    description: "Write a Python program to convert a given string to uppercase and lowercase.",
    category: "Strings",
    code: `text = "Hello Python"
print("Uppercase:", text.upper())
print("Lowercase:", text.lower())`
  },
  {
    id: "d5",
    num: 5,
    title: "Even or Odd",
    description: "Write a Python program to check if a number is even or odd.",
    category: "Conditionals",
    code: `num = int(input("Enter a number: "))
if num % 2 == 0:
    print(f"{num} is even")
else:
    print(f"{num} is odd")`
  },
  {
    id: "d6",
    num: 6,
    title: "Greatest Among n Numbers",
    description: "Write a Python program to find the greatest number among n numbers.",
    category: "Conditionals",
    code: `n = int(input("How many numbers? "))
numbers = []
for i in range(n):
    numbers.append(float(input(f"Enter number {i+1}: ")))

greatest = numbers[0]
for value in numbers:
    if value > greatest:
        greatest = value

print(f"The greatest number is {greatest}")`
  },
  {
    id: "d7",
    num: 7,
    title: "Print 1 to 10 (for loop)",
    description: "Write a Python program to print numbers from 1 to 10 using a for loop.",
    category: "Loops",
    code: `for i in range(1, 11):
    print(i)`
  },
  {
    id: "d8",
    num: 8,
    title: "Even Numbers 1 to 100",
    description: "Write a Python program to print all even numbers from 1 to 100 using a for loop.",
    category: "Loops",
    code: `for i in range(2, 101, 2):
    print(i)`
  },
  {
    id: "d9",
    num: 9,
    title: "Sum of Odd Numbers 1 to 50",
    description: "Write a Python program to print the sum of all odd numbers from 1 to 50 using a while loop.",
    category: "Loops",
    code: `num = 1
total = 0
while num <= 50:
    if num % 2 != 0:
        total += num
    num += 1

print(f"Sum of odd numbers from 1 to 50 is {total}")`
  },
  {
    id: "d10",
    num: 10,
    title: "Multiplication Table",
    description: "Write a Python program to print the multiplication table of a given number.",
    category: "Loops",
    code: `num = int(input("Enter a number: "))
for i in range(1, 11):
    print(f"{num} x {i} = {num * i}")`
  },
  {
    id: "d11",
    num: 11,
    title: "Factorial of a Number",
    description: "Write a Python program to find the factorial of a number.",
    category: "Loops",
    code: `num = int(input("Enter a number: "))
factorial = 1

if num < 0:
    print("Factorial does not exist for negative numbers")
else:
    for i in range(1, num + 1):
        factorial *= i
    print(f"The factorial of {num} is {factorial}")`
  },
  {
    id: "d12",
    num: 12,
    title: "Reverse of a Number",
    description: "Write a Python program to print the reverse of a given number.",
    category: "Numbers",
    code: `num = int(input("Enter a number: "))
reversed_num = 0

n = abs(num)
while n > 0:
    digit = n % 10
    reversed_num = reversed_num * 10 + digit
    n //= 10

if num < 0:
    reversed_num = -reversed_num

print(f"Reversed number: {reversed_num}")`
  },
  {
    id: "d13",
    num: 13,
    title: "Fibonacci Series",
    description: "Write a Python program to print the Fibonacci series.",
    category: "Loops",
    code: `n = int(input("How many terms? "))
a, b = 0, 1

print("Fibonacci Series:")
for _ in range(n):
    print(a, end=" ")
    a, b = b, a + b
print()`
  },
  {
    id: "d14",
    num: 14,
    title: "Armstrong Number",
    description: "Write a Python program to check if a number is an Armstrong number.",
    category: "Numbers",
    code: `num = int(input("Enter a number: "))
digits = str(num)
power = len(digits)

total = sum(int(d) ** power for d in digits)

if total == num:
    print(f"{num} is an Armstrong number")
else:
    print(f"{num} is not an Armstrong number")`
  },
  {
    id: "d15",
    num: 15,
    title: "Sum of Digits",
    description: "Write a Python program to print the sum of the digits of a given number.",
    category: "Numbers",
    code: `num = int(input("Enter a number: "))
total = 0
n = abs(num)

while n > 0:
    total += n % 10
    n //= 10

print(f"Sum of digits: {total}")`
  },
  {
    id: "d16",
    num: 16,
    title: "Sum of List Elements",
    description: "Write a Python program to find the sum of all elements in a list using a for loop.",
    category: "Lists",
    code: `numbers = [12, 5, 8, 21, 34, 3]
total = 0

for value in numbers:
    total += value

print(f"List: {numbers}")
print(f"Sum of elements: {total}")`
  },
  {
    id: "d17",
    num: 17,
    title: "Max and Min in a List",
    description: "Write a Python program to find the maximum and minimum elements in a list.",
    category: "Lists",
    code: `numbers = [12, 5, 8, 21, 34, 3]

maximum = numbers[0]
minimum = numbers[0]

for value in numbers:
    if value > maximum:
        maximum = value
    if value < minimum:
        minimum = value

print(f"List: {numbers}")
print(f"Maximum: {maximum}")
print(f"Minimum: {minimum}")`
  },
  {
    id: "d18",
    num: 18,
    title: "Remove Duplicates from a List",
    description: "Write a Python program to remove duplicates from a list.",
    category: "Lists",
    code: `numbers = [1, 2, 2, 3, 4, 4, 5, 1]
unique_numbers = []

for value in numbers:
    if value not in unique_numbers:
        unique_numbers.append(value)

print(f"Original list: {numbers}")
print(f"List without duplicates: {unique_numbers}")`
  },
  {
    id: "d19",
    num: 19,
    title: "Create and Print a Dictionary",
    description: "Write a Python program to create a dictionary, add key-value pairs, and print the dictionary.",
    category: "Dictionaries",
    code: `student = {}
student["name"] = "Priya"
student["age"] = 20
student["course"] = "Computer Science"

print("Student dictionary:")
print(student)

for key, value in student.items():
    print(f"{key}: {value}")`
  },
  {
    id: "d20",
    num: 20,
    title: "Reverse a String",
    description: "Write a Python program to reverse a string.",
    category: "Strings",
    code: `text = "Python"
reversed_text = text[::-1]
print(f"Original: {text}")
print(f"Reversed: {reversed_text}")`
  },
  {
    id: "d21",
    num: 21,
    title: "Count Vowels in a String",
    description: "Write a Python program to count the number of vowels in a string.",
    category: "Strings",
    code: `text = input("Enter a string: ")
vowels = "aeiouAEIOU"
count = 0

for char in text:
    if char in vowels:
        count += 1

print(f"Number of vowels: {count}")`
  },
  {
    id: "d22",
    num: 22,
    title: "Length of a String",
    description: "Write a Python program to find the length of a string.",
    category: "Strings",
    code: `text = input("Enter a string: ")
print(f"Length of the string: {len(text)}")`
  },
  {
    id: "d23",
    num: 23,
    title: "Check Palindrome",
    description: "Write a Python program to check if a string is a palindrome.",
    category: "Strings",
    code: `text = input("Enter a string: ")
cleaned = text.replace(" ", "").lower()

if cleaned == cleaned[::-1]:
    print(f'"{text}" is a palindrome')
else:
    print(f'"{text}" is not a palindrome')`
  },
  {
    "id": "d24",
    "num": 24,
    "title": "Check if a number is positive, negative or neutral",
    "description": "Write a Python program to input a number and check if the number is positive, negative or neutral.",
    "code": "n = float(input(\"Enter a number: \"))\nif n<0:\n    print(f\"{n} is a negative number\")\nelif n>0:\n    print(f\"{n} is a positive number\")\nelse:\n    print(f\"{n} is a neutral number\")",
    "category": "Conditionals"
  },
  {
    id: "d25",
    num: 25,
    title: 'Print "Hello, World!"',
    description: "Write a Python program to print \"Hello, World!\" using a user defined function.",
    category: "User-defined Function",
    code: `def greet():
    print("Hello, World!")
greet()`
  },
  {
    id: "d26",
    num: 26,
    title: "Celsius to Fahrenheit",
    description: "Write a Python program to convert a temperature from Celsius to Fahrenheit using a user defined function.",
    category: "User-defined Function",
    code: `def celsius_to_fahrenheit(celsius):
    return (celsius * 9/5) + 32
celsius = float(input("Enter temperature in Celsius: "))
fahrenheit = celsius_to_fahrenheit(celsius)
print(f"{celsius}°C is equal to {fahrenheit}°F")`
  },
  {
    id: "d27",
    num: 27,
    title: "Name and Age with f-strings",
    description: "Write a Python program using f-strings inside user defined a function to display a person's details.",
    category: "User-defined Function",
    code: `def display_person_info(name, age):
    print(f"My name is {name} and I am {age} years old.")
display_person_info("Aarav", 21)`
  },
  {
    id: "d28",
    num: 28,
    title: "Uppercase and Lowercase",
    description: "Write a Python program to convert a given string to uppercase and lowercase using a user defined function.",
    category: "User-defined Function",
    code: `def print_case_conversions(text):
    print("Uppercase:", text.upper())
    print("Lowercase:", text.lower())
print_case_conversions("Hello Python")`
  },
  {
    id: "d29",
    num: 29,
    title: "Even or Odd",
    description: "Write a Python program to check if a number is even or odd using a user defined function.",
    category: "User-defined Function",
    code: `def is_even(number):
    return number % 2 == 0
num = int(input("Enter a number: "))
if is_even(num):
    print(f"{num} is even")
else:
    print(f"{num} is odd")`
  },
  {
    id: "d30",
    num: 30,
    title: "Greatest Among n Numbers",
    description: "Write a Python program to find the greatest number among a list of numbers using a user defined function.",
    category: "User-defined Function",
    code: `def find_greatest(numbers):
    greatest = numbers[0]
    for value in numbers:
        if value > greatest:
            greatest = value
    return greatest
n = int(input("How many numbers? "))
nums = []
for i in range(n):
    nums.append(float(input(f"Enter number {i+1}: ")))

print(f"The greatest number is {find_greatest(nums)}")`
  },
  {
    id: "d31",
    num: 31,
    title: "Print 1 to 10 (for loop)",
    description: "Write a Python program using a user defined function to print numbers from 1 to a given limit.",
    category: "User-defined Function",
    code: `def print_numbers(limit):
    for i in range(1, limit + 1):
        print(i)
print_numbers(10)`
  },
  {
    id: "d32",
    num: 32,
    title: "Even Numbers 1 to 100",
    description: "Write a Python program using a user defined function to print all even numbers up to a specified limit.",
    category: "User-defined Function",
    code: `def print_even_numbers(limit):
    for i in range(2, limit + 1, 2):
        print(i)
print_even_numbers(100)`
  },
  {
    id: "d33",
    num: 33,
    title: "Sum of Odd Numbers 1 to 50",
    description: "Write a Python program to compute the sum of all odd numbers up to a given limit using a while loop in a user defined function.",
    category: "User-defined Function",
    code: `def sum_of_odds(limit):
    num = 1
    total = 0
    while num <= limit:
        if num % 2 != 0:
            total += num
        num += 1
    return total
limit_val = 50
print(f"Sum of odd numbers from 1 to {limit_val} is {sum_of_odds(limit_val)}")`
  },
  {
    id: "d34",
    num: 34,
    title: "Multiplication Table",
    description: "Write a Python program to print the multiplication table of a given number using user defined function.",
    category: "User-defined Function",
    code: `def print_multiplication_table(num, steps=10):
    for i in range(1, steps + 1):
        print(f"{num} x {i} = {num * i}")
number = int(input("Enter a number: "))
print_multiplication_table(number)`
  },
  {
    id: "d35",
    num: 35,
    title: "Factorial of a Number",
    description: "Write a Python program to calculate the factorial of a number using user defined function.",
    category: "User-defined Function",
    code: `def calculate_factorial(num):
    if num < 0:
        return None
    factorial = 1
    for i in range(1, num + 1):
        factorial *= i
    return factorial
num = int(input("Enter a number: "))
result = calculate_factorial(num)
if result is None:
    print("Factorial does not exist for negative numbers")
else:
    print(f"The factorial of {num} is {result}")`
  },
  {
    id: "d36",
    num: 36,
    title: "Reverse of a Number",
    description: "Write a Python program to reverse a given integer using user defined function.",
    category: "User-defined Function",
    code: `def reverse_number(num):
    reversed_num = 0
    n = abs(num)
    while n > 0:
        digit = n % 10
        reversed_num = reversed_num * 10 + digit
        n //= 10
    return -reversed_num if num < 0 else reversed_num
num = int(input("Enter a number: "))
print(f"Reversed number: {reverse_number(num)}")`
  },
  {
    id: "d37",
    num: 37,
    title: "Fibonacci Series",
    description: "Write a Python program to print the Fibonacci series up to n terms using user defined function.",
    category: "User-defined Function",
    code: `def generate_fibonacci(terms):
    a, b = 0, 1
    series = []
    for _ in range(terms):
        series.append(a)
        a, b = b, a + b
    return series
n = int(input("How many terms? "))
print("Fibonacci Series:")
print(*generate_fibonacci(n))`
  },
  {
    id: "d38",
    num: 38,
    title: "Armstrong Number",
    description: "Write a Python program to check whether a given number is an Armstrong number using user defined function.",
    category: "User-defined Function",
    code: `def is_armstrong(num):
    digits = str(num)
    power = len(digits)
    total = sum(int(d) ** power for d in digits)
    return total == num
num = int(input("Enter a number: "))
if is_armstrong(num):
    print(f"{num} is an Armstrong number")
else:
    print(f"{num} is not an Armstrong number")`
  },
  {
    id: "d39",
    num: 39,
    title: "Sum of Digits",
    description: "Write a Python program to compute the sum of the digits of a given number using user defined function.",
    category: "User-defined Function",
    code: `def sum_of_digits(num):
    total = 0
    n = abs(num)
    while n > 0:
        total += n % 10
        n //= 10
    return total
num = int(input("Enter a number: "))
print(f"Sum of digits: {sum_of_digits(num)}")`
  },
  {
    id: "d40",
    num: 40,
    title: "Sum of List Elements",
    description: "Write a Python program to calculate the total sum of elements in a list using user defined function.",
    category: "User-defined Function",
    code: `def sum_list(numbers):
    total = 0
    for value in numbers:
        total += value
    return total
numbers = [12, 5, 8, 21, 34, 3]
print(f"List: {numbers}")
print(f"Sum of elements: {sum_list(numbers)}")`
  },
  {
    id: "d41",
    num: 41,
    title: "Max and Min in a List",
    description: "Write a Python program that finds and returns both maximum and minimum values in a list using user defined function.",
    category: "User-defined Function",
    code: `def find_min_max(numbers):
    maximum = numbers[0]
    minimum = numbers[0]
    for value in numbers:
        if value > maximum:
            maximum = value
        if value < minimum:
            minimum = value
    return minimum, maximum
numbers = [12, 5, 8, 21, 34, 3]
minimum, maximum = find_min_max(numbers)
print(f"List: {numbers}")
print(f"Maximum: {maximum}")
print(f"Minimum: {minimum}")`
  },
  {
    id: "d42",
    num: 42,
    title: "Remove Duplicates from a List",
    description: "Write a Python program to remove duplicate elements from a list while preserving order using user defined function.",
    category: "User-defined Function",
    code: `def remove_duplicates(lst):
    unique_items = []
    for value in lst:
        if value not in unique_items:
            unique_items.append(value)
    return unique_items
numbers = [1, 2, 2, 3, 4, 4, 5, 1]
print(f"Original list: {numbers}")
print(f"List without duplicates: {remove_duplicates(numbers)}")`
  },
  {
    id: "d43",
    num: 43,
    title: "Create and Print a Dictionary",
    description: "Write a Python program to build and display a student dictionary using user defined function.",
    category: "User-defined Function",
    code: `def create_student(name, age, course):
    student = {
        "name": name,
        "age": age,
        "course": course
    }
    return student

def print_dictionary(data):
    for key, value in data.items():
        print(f"{key}: {value}")
student_info = create_student("Priya", 20, "Computer Science")
print("Student dictionary:")
print_dictionary(student_info)`
  },
  {
    id: "d44",
    num: 44,
    title: "Reverse a String",
    description: "Write a Python program to return the reverse of a string using user defined function.",
    category: "User-defined Function",
    code: `def reverse_string(text):
    return text[::-1]
text = "Python"
print(f"Original: {text}")
print(f"Reversed: {reverse_string(text)}")`
  },
  {
    id: "d45",
    num: 45,
    title: "Count Vowels in a String",
    description: "Write a Python program to count and return the number of vowels in a string using user defined function.",
    category: "User-defined Function",
    code: `def count_vowels(text):
    vowels = "aeiouAEIOU"
    count = 0
    for char in text:
        if char in vowels:
            count += 1
    return count
input_text = input("Enter a string: ")
print(f"Number of vowels: {count_vowels(input_text)}")`
  },
  {
    id: "d46",
    num: 46,
    title: "Length of a String",
    description: "Write a Python program to calculate the length of a string using user defined function.",
    category: "User-defined Function",
    code: `def get_string_length(text):
    return len(text)
text = input("Enter a string: ")
print(f"Length of the string: {get_string_length(text)}")`
  },
  {
    id: "d47",
    num: 47,
    title: "Check Palindrome",
    description: "Write a Python program to check if a given string is a palindrome using user defined function.",
    category: "User-defined Function",
    code: `def is_palindrome(text):
    cleaned = text.replace(" ", "").lower()
    return cleaned == cleaned[::-1]
text = input("Enter a string: ")
if is_palindrome(text):
    print(f'"{text}" is a palindrome')
else:
    print(f'"{text}" is not a palindrome')`
  },
  {
    id: "d48",
    num: 48,
    title: "Check if a number is positive, negative or neutral",
    description: "Write a Python program to input a number and check if the number is positive, negative or neutral using a user defined function.",
    category: "User-defined Function",
    code: `def check_number_sign(num):
    if num < 0:
        return f"{num} is a negative number"
    elif num > 0:
        return f"{num} is a positive number"
    else:
        return f"{num} is a neutral number"
n = float(input("Enter a number: "))
print(check_number_sign(n))`
  },
  {
    id: "d49",
    num: 49,
    title: "Check greater between two number",
    description: "Write a Python program to input two number and check greater between them using a user defined function.",
    category: "User-defined Function",
    code: `def is_greater(a,b):
    if a>b:
        greater = a
    else:
        greater = b
    return greater
n1 = float(input("Enter first number: "))
n2 = float(input("Enter second number: "))
print(f"The greater number is {is_greater(n1,n2)}")`
  }
];

const snippetContainer = document.getElementById('snippet-container');
const categoryButtons = document.querySelectorAll('.category-btn');
const currentCategoryTitle = document.getElementById('current-category');
const loaderBanner = document.getElementById('pyodide-loader');
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const searchInput = document.getElementById('search-input');

let pyodideInstance = null;
let activeOutputElement = null;
let currentCategory = 'all';

async function initPyodide() {
    try {
        pyodideInstance = await loadPyodide({
            // Add the stdin handler using window.prompt
            stdin: () => {
                let result = prompt("Python is asking for input:");
                // Return an empty string if the user clicks cancel to prevent crashes
                return result !== null ? result : ""; 
            },
            stdout: (text) => {
                if (activeOutputElement) {
                    activeOutputElement.textContent += text; 
                }
            },
            stderr: (text) => {
                if (activeOutputElement) {
                    activeOutputElement.textContent += text; 
                }
            }
        });
        
        loaderBanner.textContent = "Python Environment Ready";
        loaderBanner.classList.add('ready');
        
        document.querySelectorAll('.run-btn').forEach(btn => btn.disabled = false);
        
        setTimeout(() => {
            loaderBanner.style.display = 'none';
        }, 3000);

    } catch (err) {
        loaderBanner.textContent = "Failed to load Python environment. Check your connection.";
        loaderBanner.style.backgroundColor = "#ff5555";
        console.error("Pyodide init failed:", err);
    }
}

initPyodide();

function renderSnippets() {
    snippetContainer.innerHTML = ''; 

    const searchQuery = searchInput.value.toLowerCase().trim();

    const filteredSnippets = snippets.filter(snippet => {
        const matchesCategory = currentCategory === 'all' || snippet.category === currentCategory;
        const matchesSearch = searchQuery === '' || 
            snippet.title.toLowerCase().includes(searchQuery) || 
            snippet.description.toLowerCase().includes(searchQuery) || 
            snippet.code.toLowerCase().includes(searchQuery);

        return matchesCategory && matchesSearch;
    });

    if (filteredSnippets.length === 0) {
        snippetContainer.innerHTML = '<p>No snippets found matching your criteria.</p>';
        return;
    }

    filteredSnippets.forEach(snippet => {
        const card = document.createElement('div');
        card.className = 'snippet-card';
        
        const isReady = pyodideInstance !== null;
        
        card.innerHTML = `
            <span class="badge">${formatCategoryName(snippet.category)}</span>
            <div class="snippet-header">
                <h3>${snippet.title}</h3>
                <div class="action-buttons">
                    <button class="run-btn" ${isReady ? '' : 'disabled'}>Run Code</button>
                    <button class="copy-btn">Copy Code</button>
                </div>
            </div>
            <p style="margin-bottom: 1rem;">${snippet.description}</p>
            <pre><code class="language-python">${escapeHTML(snippet.code)}</code></pre>
            <div class="output-container" id="output-${snippet.id}"></div>
        `;

        const runBtn = card.querySelector('.run-btn');
        runBtn.addEventListener('click', () => runPythonCode(snippet.code, `output-${snippet.id}`, runBtn));

        const copyBtn = card.querySelector('.copy-btn');
        copyBtn.addEventListener('click', function() {
            copyToClipboard(this, snippet.code);
        });

        snippetContainer.appendChild(card);
    });

    if (window.Prism) {
        Prism.highlightAll();
    }
}

async function runPythonCode(code, outputId, btnElement) {
    if (!pyodideInstance) return;

    activeOutputElement = document.getElementById(outputId);
    activeOutputElement.style.display = "block";
    activeOutputElement.textContent = ""; 
    activeOutputElement.style.color = "#4CAF50"; 
    
    btnElement.disabled = true;
    btnElement.textContent = "Running...";

    try {
        let finalCode = code;

        // Check if the snippet uses input()
        const inputMatch = code.match(/input\s*\((.*?)\)/);
        if (inputMatch) {
            let promptText = inputMatch[1] ? inputMatch[1].replace(/['"]/g, '') : "Enter value: ";
            
            // Print the prompt text inside the output box first
            activeOutputElement.textContent += promptText;

            // Create an inline input element right inside the output container
            let userInput = await new Promise((resolve) => {
                let inputField = document.createElement('input');
                inputField.type = 'text';
                inputField.className = 'inline-input';
                activeOutputElement.appendChild(inputField);
                inputField.focus();

                inputField.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        let val = inputField.value;
                        inputField.remove();
                        // Echo back what the user typed into the output feed
                        activeOutputElement.textContent += val + "\n";
                        resolve(val);
                    }
                });
            });

            // Substitute the input() expression with the user's typed value
            finalCode = code.replace(/input\s*\(.*?\)/g, `"${userInput}"`);
        }

        await pyodideInstance.runPythonAsync(finalCode);
        
        if (activeOutputElement.textContent.trim() === "") {
             activeOutputElement.textContent = "[Program executed successfully with no output]";
        }
    } catch (err) {
        activeOutputElement.style.color = "#ff5555";
        activeOutputElement.textContent += err.toString();
    } finally {
        btnElement.disabled = false;
        btnElement.textContent = "Run Code";
        activeOutputElement = null;
    }
}
const categoryList = document.getElementById('category-list');

// Function to dynamically generate categories from the snippets array
function renderCategories() {
    // 1. Extract unique categories using a Set
    const uniqueCategories = [...new Set(snippets.map(snippet => snippet.category))];

    // 2. Start with the default 'All Snippets' button
    categoryList.innerHTML = `
        <li>
            <button class="category-btn active" data-category="all">All Snippets</button>
        </li>
    `;

    // 3. Loop through unique categories and create buttons
    uniqueCategories.forEach(category => {
        const li = document.createElement('li');
        li.innerHTML = `<button class="category-btn" data-category="${category}">${category}</button>`;
        categoryList.appendChild(li);
    });
}

// Use Event Delegation to handle clicks on dynamically generated buttons
categoryList.addEventListener('click', (e) => {
    // Ensure we are clicking on a category button
    if (e.target.classList.contains('category-btn')) {
        // Remove 'active' class from all buttons
        document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
        
        // Add 'active' class to the clicked button
        e.target.classList.add('active');

        // Update the current category state and UI
        currentCategory = e.target.getAttribute('data-category');
        currentCategoryTitle.textContent = e.target.textContent;
        
        // Re-render the snippets
        renderSnippets();

        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        }
    }
});

// Initialize the categories on load
renderCategories();

searchInput.addEventListener('input', () => {
    renderSnippets();
});

menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
});

overlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
});

function copyToClipboard(button, code) {
    navigator.clipboard.writeText(code).then(() => {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
            button.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

function formatCategoryName(slug) {
    return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

renderSnippets();
