# 控制台打字游戏 - 四语言版本

适合工作摸鱼的极简控制台打字游戏，用4种主流编程语言实现同一功能，帮助理解不同语言的语法差异。

## 目录
- [快速开始](#快速开始)
- [环境准备](#环境准备)
- [运行方法](#运行方法)
- [语法对比](#语法对比)
- [文件说明](#文件说明)

---

## 快速开始

选择你会的语言直接运行：

```powershell
# Python (最简单，无需编译)
python typing_game.py

# Java (需要JDK)
javac TypingGame.java
java TypingGame

# C++ (需要g++编译器，见下方安装)
g++ typing_game.cpp -o typing_game.exe
.\typing_game.exe

# C# (需要.NET SDK)
dotnet new console -n TypingGameApp --force
copy TypingGame.cs TypingGameApp\Program.cs
cd TypingGameApp
dotnet run
```

---

## 环境准备

### 1. Python (最简单)
- 已安装Python？直接运行！
- 未安装？访问 https://python.org 下载安装
- 安装时勾选 **"Add Python to PATH"**

### 2. Java
- 安装JDK 11或更高版本
- 验证安装：`java -version` 和 `javac -version`

### 3. C++ (Windows)

**方案A - 使用Visual Studio (推荐)**
1. 安装 Visual Studio Community (免费)
2. 安装时选择 **"使用C++的桌面开发"** 工作负载
3. 打开 "Developer Command Prompt for VS"，输入：
   ```cmd
   cl typing_game.cpp
   typing_game.exe
   ```

**方案B - 使用MinGW (轻量级)**
1. 访问 https://www.mingw-w64.org/downloads/
2. 下载并安装 MinGW-w64
3. 将 `C:\mingw64\bin` 添加到系统环境变量PATH
4. 重启终端，输入 `g++ --version` 验证

### 4. C# (最简单的方式)
1. 安装 .NET SDK: https://dotnet.microsoft.com/download
2. 打开PowerShell或CMD，输入 `dotnet --version` 验证

---

## 运行方法

### Python 版本
```powershell
cd E:\vscode\Programs\test\game
python typing_game.py
```
**特点**: 无需编译，解释执行，语法最简单

### Java 版本
```powershell
cd E:\vscode\Programs\test\game
javac TypingGame.java          # 编译，生成 TypingGame.class
java TypingGame                # 运行
```
**特点**: 需要编译，面向对象，跨平台

### C++ 版本

**使用g++ (MinGW):**
```powershell
cd E:\vscode\Programs\test\game
g++ -std=c++11 typing_game.cpp -o typing_game.exe   # 编译
typing_game.exe                                     # 运行
```

**使用Visual Studio编译器:**
```cmd
cd E:\vscode\Programs\test\game
cl typing_game.cpp      # 编译 (在VS Developer Prompt中)
typing_game.exe         # 运行
```

**特点**: 需要编译，性能最高，手动内存管理（本例中不明显）

### C# 版本

```powershell
cd E:\vscode\Programs\test\game

# 创建临时项目
dotnet new console -n TypingGameApp --force

# 复制代码到项目
copy TypingGame.cs TypingGameApp\Program.cs

# 运行
cd TypingGameApp
dotnet run

# 或者编译成exe
dotnet build -c Release
# 生成的exe在: bin\Release\netX.X\TypingGameApp.exe
```

**特点**: 需要编译，现代化语法，自动内存管理

---

## 语法对比

### 1. 变量声明

| Python | Java | C++ | C# |
|--------|------|-----|-----|
| `x = 10` | `int x = 10;` | `int x = 10;` | `int x = 10;` 或 `var x = 10;` |
| `name = "abc"` | `String name = "abc";` | `std::string name = "abc";` | `string name = "abc";` 或 `var name = "abc";` |
| **无需声明类型** | **强类型，显式声明** | **强类型，显式声明** | **强类型，但可用var推断** |

### 2. 数组/列表

| Python | Java | C++ | C# |
|--------|------|-----|-----|
| `list = ["a", "b"]` | `String[] arr = {"a", "b"};` | `std::vector<std::string> vec;` | `string[] arr = {"a", "b"};` 或 `var list = new List<string>();` |
| `list.append("c")` | `list.add("c")` | `vec.push_back("c")` | `list.Add("c")` |
| **动态列表** | **数组固定大小，ArrayList动态** | **vector动态数组** | **List动态，数组固定** |

### 3. 函数/方法定义

| Python | Java | C++ | C# |
|--------|------|-----|-----|
| `def func():` | `void func() { }` | `void func() { }` | `void Func() { }` |
| `def add(a, b):` | `int add(int a, int b) { }` | `int add(int a, int b) { }` | `int Add(int a, int b) { }` |
| **无返回类型声明** | **需声明返回类型** | **需声明返回类型** | **需声明返回类型** |

### 4. 类定义

**Python:**
```python
class MyClass:
    def __init__(self):
        self.value = 0
```

**Java:**
```java
public class MyClass {
    private int value;
    public MyClass() {
        this.value = 0;
    }
}
```

**C++:**
```cpp
class MyClass {
private:
    int value;
public:
    MyClass() : value(0) {}
};
```

**C#:**
```csharp
public class MyClass {
    public int Value { get; private set; }
    public MyClass() {
        Value = 0;
    }
}
```

### 5. 输入输出

| Python | Java | C++ | C# |
|--------|------|-----|-----|
| `print("hi")` | `System.out.println("hi");` | `std::cout << "hi" << std::endl;` | `Console.WriteLine("hi");` |
| `input()` | `scanner.nextLine()` | `std::getline(std::cin, str)` | `Console.ReadLine()` |
| **最简单** | **较繁琐** | **较繁琐** | **简洁** |

### 6. 条件判断

| Python | Java/C++ | C# |
|--------|----------|-----|
| `if x > 5:` | `if (x > 5) { }` | `if (x > 5) { }` |
| `elif:` | `else if` | `else if` |
| **冒号+缩进** | **花括号** | **花括号** |

### 7. 循环

| Python | Java/C++ | C# |
|--------|----------|-----|
| `for item in list:` | `for (int i = 0; i < n; i++) { }` | `foreach (var item in list) { }` |
| `while True:` | `while (true) { }` | `while (true) { }` |

---

## 文件说明

| 文件 | 语言 | 特点 | 适合学习 |
|------|------|------|----------|
| `typing_game.py` | Python | 简洁，无编译 | 快速上手，算法逻辑 |
| `TypingGame.java` | Java | 纯面向对象，多类分离 | OOP概念，类设计 |
| `typing_game.cpp` | C++ | 接近底层，性能导向 | 内存管理，STL容器 |
| `TypingGame.cs` | C# | 现代化语法，属性/LINQ | .NET生态，现代语言特性 |

---

## 学习建议

1. **先跑通Python版本** - 理解游戏逻辑
2. **对比Java版本** - 学习面向对象设计（类分离）
3. **尝试C++版本** - 了解编译型语言，STL容器
4. **探索C#版本** - 体验现代语法糖（属性、lambda、LINQ）

每个文件顶部都有详细的语法注释，按行解释关键代码。

---

## 常见问题

**Q: 运行C++时报错 "g++ 不是内部或外部命令"?**
A: 未安装MinGW或环境变量配置错误。建议安装Visual Studio Community，使用它的Developer Command Prompt。

**Q: 运行Java时报错 "找不到或无法加载主类"?**
A: 确保编译成功（生成.class文件），且运行时不需要加.java后缀：`java TypingGame`

**Q: C#的dotnet命令找不到？**
A: 安装.NET SDK后需要重启终端或重启电脑。

**Q: 怎么退出游戏？**
A: 按 `Ctrl+C` 或游戏结束后输入 `n` 不继续。

---

## 项目结构

```
E:\vscode\Programs\test\game\
├── typing_game.py      # Python版本
├── TypingGame.java     # Java版本
├── typing_game.cpp     # C++版本
├── TypingGame.cs       # C#版本
└── README.md           # 本文件
```

## 学习路线图

如果你完全不懂C++和C#，建议按这个顺序：

1. **第1天**: 阅读本README，了解4种语言的差异
2. **第2天**: 运行所有版本，体验不同语言的编译/运行流程
3. **第3-5天**: 仔细阅读C++代码，对照Python/Java理解语法
4. **第6-7天**: 仔细阅读C#代码，注意它和Java的相似与不同
5. **第8天+**: 尝试修改代码（改时间、加单词、调整难度），看每种语言如何实现

**关键要对比的语法点**:
- 变量如何声明？（Python无类型 vs 其他有类型）
- 字符串怎么比较？（== vs equals vs compare）
- 数组/列表如何操作？（append/add/push_back）
- 时间如何获取？（time.time() vs System.currentTimeMillis() vs chrono vs DateTime）
- 输入如何读取？（input vs Scanner vs cin vs Console.ReadLine）

祝你学习愉快！继续搬砖！
