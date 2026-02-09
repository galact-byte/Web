/*
 * 控制台打字游戏 - C++版本
 * 编译命令: g++ -std=c++11 typing_game.cpp -o typing_game.exe
 * 运行命令: typing_game.exe
 * 
 * C++是编译型语言，需要先编译成可执行文件再运行
 * 本程序展示了C++的基础语法：STL容器、字符串处理、时间获取
 */

// 【头文件】类似Python的import，C++需要显式包含所需功能
#include <iostream>   // 输入输出流（cout/cin）
#include <vector>     // 动态数组容器（类似Python的list）
#include <string>     // 字符串类
#include <chrono>     // 时间库（C++11标准）
#include <thread>     // 线程相关（本例未使用）
#include <cstdlib>    // 标准库（rand/srand）
#include <ctime>      // 时间相关（time函数）
#include <algorithm>  // 算法库（transform函数）
#include <cctype>     // 字符处理（tolower函数）

// 【命名空间】std是C++标准库的命名空间
// 类似Python的模块前缀，可以用using简化，或者用std::前缀
// using namespace std; // 如果加这行，下面就不用写std::了

// 【常量数组】const表示不可修改，类似Python没有const概念
// std::vector是C++的动态数组，类似Python的list
// <std::string>是模板参数，指定数组存储字符串
// C++是强类型语言，必须声明类型
const std::vector<std::string> WORDS = {
    "include", "iostream", "vector", "string", "namespace", "std", "const",
    "int", "char", "float", "double", "struct", "class", "public", "private",
    "void", "return", "if", "else", "for", "while", "switch", "case",
    "sizeof", "malloc", "free", "new", "delete", "const", "pointer", "reference",
    "static", "extern", "inline", "template", "typename", "virtual", "override",
    "variable", "function", "method", "parameter", "argument",
    "array", "loop", "condition", "recursion", "algorithm",
    "debug", "compile", "runtime", "syntax", "exception",
    "git", "commit", "push", "pull", "merge", "branch",
    "api", "json", "database", "server", "frontend", "backend"
};

// 【函数定义】void表示无返回值，类似Python的def func():
// C++需要声明返回类型和参数类型，Python不需要
void clearScreen() {
    // 【for循环】C++的for语法：(初始化; 条件; 更新)
    // 类似Python的 for i in range(50)，但更灵活
    for (int i = 0; i < 50; i++) {
        // 【输出】std::cout 是C++的标准输出流，类似Python的print
        // << 是流插入运算符，把数据推送到输出流
        // std::endl 是换行符，类似Python的\n
        std::cout << std::endl;
    }
}

void printHeader() {
    std::cout << "==================================================" << std::endl;
    std::cout << "  控制台打字游戏 - C++版 (高性能版)" << std::endl;
    std::cout << "==================================================" << std::endl;
    std::cout << std::endl;
}

// 【函数返回vector】std::vector<std::string>是返回类型
// 类似Python返回list，但C++必须声明类型
std::vector<std::string> getShortWords() {
    // 【局部变量】在栈上分配内存，函数结束时自动释放
    std::vector<std::string> result;
    
    // 【范围for循环】C++11特性，类似Python的 for word in WORDS:
    // const auto& 表示：常量、自动推导类型、引用（避免复制）
    for (const auto& word : WORDS) {
        // 【条件判断】if (条件) { }，必须用花括号
        if (word.length() <= 5) {
            // 【添加元素】push_back 类似Python的 append()
            result.push_back(word);
        }
    }
    // 【return语句】C++需要显式return，Python可以省略
    return result;
}

std::vector<std::string> getLongWords() {
    std::vector<std::string> result;
    for (const auto& word : WORDS) {
        if (word.length() >= 6) {
            result.push_back(word);
        }
    }
    return result;
}

// 【结构体】struct是C++的轻量级类，默认成员公有
// 类似Python的类或Java的class，但更简洁
// 这里存储游戏难度设置：时间限制和单词池
struct DifficultySettings {
    int timeLimit;                        // 【成员变量】int是整数类型
    std::vector<std::string> wordPool;  // 【成员变量】vector存储单词列表
};

DifficultySettings selectDifficulty() {
    std::cout << "选择难度:" << std::endl;
    std::cout << "  1. 简单 (60秒, 短词汇)" << std::endl;
    std::cout << "  2. 中等 (60秒, 全部词汇)" << std::endl;
    std::cout << "  3. 困难 (45秒, 长词汇)" << std::endl;
    std::cout << std::endl;
    
    while (true) {
        std::cout << "输入数字 (1-3): ";
        std::string choice;
        std::getline(std::cin, choice);
        
        if (choice == "1") {
            return {60, getShortWords()};
        } else if (choice == "2") {
            return {60, WORDS};
        } else if (choice == "3") {
            return {45, getLongWords()};
        } else {
            std::cout << "无效输入，请重新选择" << std::endl;
        }
    }
}

std::string toLower(const std::string& str) {
    std::string result = str;
    std::transform(result.begin(), result.end(), result.begin(), ::tolower);
    return result;
}

void playGame(const DifficultySettings& settings, int& correctCount, int& totalCount, std::vector<std::string>& wrongWords) {
    clearScreen();
    printHeader();
    
    std::cout << "时间限制: " << settings.timeLimit << "秒" << std::endl;
    std::cout << "词汇数量: " << settings.wordPool.size() << std::endl;
    std::cout << "规则: 输入显示的单词，按Enter确认" << std::endl;
    std::cout << "准备开始..." << std::endl;
    std::cout << std::endl << "按Enter键开始!";
    std::cin.get();
    
    clearScreen();
    auto startTime = std::chrono::steady_clock::now();
    correctCount = 0;
    totalCount = 0;
    wrongWords.clear();
    
    srand(static_cast<unsigned int>(time(nullptr)));
    
    while (true) {
        auto currentTime = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(currentTime - startTime).count();
        
        if (elapsed >= settings.timeLimit) {
            break;
        }
        
        const std::string& word = settings.wordPool[rand() % settings.wordPool.size()];
        long timeLeft = settings.timeLimit - elapsed;
        
        std::cout << std::endl;
        std::cout << "[剩余时间: " << timeLeft << "秒 | 正确: " << correctCount 
                  << " | 已输入: " << totalCount << "]" << std::endl;
        std::cout << "单词: " << word << std::endl;
        std::cout << "> ";
        
        std::string userInput;
        std::getline(std::cin, userInput);
        
        if (userInput.empty()) {
            continue;
        }
        
        totalCount++;
        
        if (toLower(userInput) == toLower(word)) {
            correctCount++;
            std::cout << "✓ 正确!" << std::endl;
        } else {
            wrongWords.push_back("'" + word + "' -> 你输入: '" + userInput + "'");
            std::cout << "✗ 错误! 正确答案是: " << word << std::endl;
        }
    }
}

void showResults(int correct, int total, const std::vector<std::string>& wrongWords) {
    clearScreen();
    printHeader();
    
    std::cout << "游戏结束!" << std::endl;
    std::cout << "==================================================" << std::endl;
    std::cout << "正确: " << correct << " / " << total << std::endl;
    
    if (total > 0) {
        double accuracy = (static_cast<double>(correct) / total) * 100;
        std::cout << "准确率: " << accuracy << "%" << std::endl;
    } else {
        std::cout << "准确率: 0%" << std::endl;
    }
    
    if (!wrongWords.empty()) {
        std::cout << std::endl << "错误记录:" << std::endl;
        size_t displayCount = std::min(wrongWords.size(), static_cast<size_t>(10));
        for (size_t i = 0; i < displayCount; i++) {
            std::cout << "  " << (i + 1) << ". " << wrongWords[i] << std::endl;
        }
        if (wrongWords.size() > 10) {
            std::cout << "  ... 还有 " << (wrongWords.size() - 10) << " 个错误" << std::endl;
        }
    }
    
    std::cout << std::endl;
    if (total > 0) {
        double accuracy = static_cast<double>(correct) / total;
        if (accuracy >= 0.95 && correct >= 20) {
            std::cout << "🏆 评级: 代码大神!" << std::endl;
        } else if (accuracy >= 0.8 && correct >= 15) {
            std::cout << "⭐ 评级: 优秀程序员!" << std::endl;
        } else if (accuracy >= 0.6) {
            std::cout << "👍 评级: 还在进步!" << std::endl;
        } else {
            std::cout << "💪 评级: 继续练习!" << std::endl;
        }
    }
    std::cout << std::endl;
}

int main() {
    while (true) {
        clearScreen();
        printHeader();
        
        DifficultySettings settings = selectDifficulty();
        
        int correctCount, totalCount;
        std::vector<std::string> wrongWords;
        
        playGame(settings, correctCount, totalCount, wrongWords);
        showResults(correctCount, totalCount, wrongWords);
        
        std::cout << "再玩一次? (y/n): ";
        std::string choice;
        std::getline(std::cin, choice);
        
        if (choice != "y" && choice != "Y") {
            std::cout << std::endl << "感谢游玩! 继续搬砖..." << std::endl;
            break;
        }
    }
    
    return 0;
}
