/*
 * 控制台打字游戏 - C#版本
 * 运行命令: dotnet run (需要先创建项目，见README.md)
 * 
 * C#是编译型语言，运行在.NET虚拟机上（类似Java的JVM）
 * 本程序展示了C#的现代语法：属性、LINQ、var类型推断、Lambda表达式
 */

// 【using指令】类似Python的import，导入命名空间
// 这些是.NET框架的核心命名空间
using System;                    // 基础类型（Console, String, Random等）
using System.Collections.Generic; // 泛型集合（List<T>, Dictionary<K,V>）
using System.Linq;               // LINQ查询语言（Where, Select等）
using System.Threading;          // 多线程（本例未使用但已导入）

// 【命名空间】组织代码的容器，类似Java的package
// 防止类名冲突，便于代码管理
namespace TypingGame
{
    class Program
    {
        static void Main(string[] args)
        {
            var game = new TypingGame();
            game.Start();
        }
    }

    public class TypingGame
    {
        private static readonly string[] Words = {
            "namespace", "using", "var", "dynamic", "async", "await", "get", "set",
            "public", "private", "static", "void", "class", "interface", "string",
            "int", "double", "bool", "List", "Dictionary", "Array", "Console",
            "Task", "Action", "Func", "Event", "Delegate", "LINQ", "Lambda",
            "print", "input", "def", "return", "if", "else", "for", "while",
            "try", "catch", "finally", "throw", "new", "this", "base", "null",
            "variable", "function", "method", "parameter", "argument",
            "array", "loop", "condition", "recursion", "algorithm",
            "debug", "compile", "runtime", "syntax", "exception",
            "git", "commit", "push", "pull", "merge", "branch",
            "api", "json", "database", "server", "frontend", "backend", "fullstack"
        };

        private readonly Random _random;
        private readonly GameStats _stats;

        public TypingGame()
        {
            _random = new Random();
            _stats = new GameStats();
        }

        public void Start()
        {
            while (true)
            {
                ClearScreen();
                PrintHeader();

                var settings = SelectDifficulty();
                PlayGame(settings);
                ShowResults();

                Console.Write("\n再玩一次? (y/n): ");
                var choice = Console.ReadLine()?.Trim().ToLower();
                if (choice != "y")
                {
                    Console.WriteLine("\n感谢游玩! 继续搬砖...");
                    break;
                }
            }
        }

        private void ClearScreen()
        {
            for (int i = 0; i < 50; i++)
                Console.WriteLine();
        }

        private void PrintHeader()
        {
            Console.WriteLine("==================================================");
            Console.WriteLine("  控制台打字游戏 - C#版 (.NET现代版)");
            Console.WriteLine("==================================================");
            Console.WriteLine();
        }

        private DifficultySettings SelectDifficulty()
        {
            Console.WriteLine("选择难度:");
            Console.WriteLine("  1. 简单 (60秒, 短词汇)");
            Console.WriteLine("  2. 中等 (60秒, 全部词汇)");
            Console.WriteLine("  3. 困难 (45秒, 长词汇)");
            Console.WriteLine();

            while (true)
            {
                Console.Write("输入数字 (1-3): ");
                var choice = Console.ReadLine()?.Trim();

                switch (choice)
                {
                    case "1":
                        return new DifficultySettings(60, GetShortWords());
                    case "2":
                        return new DifficultySettings(60, Words);
                    case "3":
                        return new DifficultySettings(45, GetLongWords());
                    default:
                        Console.WriteLine("无效输入，请重新选择");
                        break;
                }
            }
        }

        private string[] GetShortWords() => 
            Words.Where(w => w.Length <= 5).ToArray();

        private string[] GetLongWords() => 
            Words.Where(w => w.Length >= 6).ToArray();

        private void PlayGame(DifficultySettings settings)
        {
            ClearScreen();
            PrintHeader();

            Console.WriteLine($"时间限制: {settings.TimeLimit}秒");
            Console.WriteLine($"词汇数量: {settings.WordPool.Length}");
            Console.WriteLine("规则: 输入显示的单词，按Enter确认");
            Console.WriteLine("准备开始...");
            Console.Write("\n按Enter键开始!");
            Console.ReadLine();

            ClearScreen();
            var startTime = DateTime.Now;
            _stats.Reset();

            while (true)
            {
                var elapsed = DateTime.Now - startTime;
                if (elapsed.TotalSeconds >= settings.TimeLimit)
                    break;

                var word = settings.GetRandomWord(_random);
                var timeLeft = (int)(settings.TimeLimit - elapsed.TotalSeconds);

                Console.WriteLine($"\n[剩余时间: {timeLeft}秒 | 正确: {_stats.CorrectCount} | 已输入: {_stats.TotalCount}]");
                Console.WriteLine($"单词: {word}");
                Console.Write("> ");

                var userInput = Console.ReadLine()?.Trim();

                if (string.IsNullOrEmpty(userInput))
                    continue;

                _stats.RecordAttempt(word, userInput);

                if (userInput.Equals(word, StringComparison.OrdinalIgnoreCase))
                {
                    Console.WriteLine("✓ 正确!");
                }
                else
                {
                    Console.WriteLine($"✗ 错误! 正确答案是: {word}");
                }
            }
        }

        private void ShowResults()
        {
            ClearScreen();
            PrintHeader();

            Console.WriteLine("游戏结束!");
            Console.WriteLine("==================================================");
            Console.WriteLine($"正确: {_stats.CorrectCount} / {_stats.TotalCount}");
            Console.WriteLine($"准确率: {_stats.Accuracy:P1}");

            var wrongWords = _stats.GetWrongWords();
            if (wrongWords.Any())
            {
                Console.WriteLine("\n错误记录:");
                var displayCount = Math.Min(wrongWords.Count, 10);
                for (int i = 0; i < displayCount; i++)
                {
                    Console.WriteLine($"  {i + 1}. {wrongWords[i]}");
                }
                if (wrongWords.Count > 10)
                {
                    Console.WriteLine($"  ... 还有 {wrongWords.Count - 10} 个错误");
                }
            }

            Console.WriteLine();
            if (_stats.Accuracy >= 0.95 && _stats.CorrectCount >= 20)
            {
                Console.WriteLine("🏆 评级: 代码大神!");
            }
            else if (_stats.Accuracy >= 0.8 && _stats.CorrectCount >= 15)
            {
                Console.WriteLine("⭐ 评级: 优秀程序员!");
            }
            else if (_stats.Accuracy >= 0.6)
            {
                Console.WriteLine("👍 评级: 还在进步!");
            }
            else
            {
                Console.WriteLine("💪 评级: 继续练习!");
            }
            Console.WriteLine();
        }
    }

    public class DifficultySettings
    {
        public int TimeLimit { get; }
        public string[] WordPool { get; }

        public DifficultySettings(int timeLimit, string[] wordPool)
        {
            TimeLimit = timeLimit;
            WordPool = wordPool;
        }

        public string GetRandomWord(Random random) => 
            WordPool[random.Next(WordPool.Length)];
    }

    public class GameStats
    {
        public int CorrectCount { get; private set; }
        public int TotalCount { get; private set; }
        public double Accuracy => TotalCount > 0 ? (double)CorrectCount / TotalCount : 0;
        
        private readonly List<string> _wrongWords;

        public GameStats()
        {
            _wrongWords = new List<string>();
        }

        public void Reset()
        {
            CorrectCount = 0;
            TotalCount = 0;
            _wrongWords.Clear();
        }

        public void RecordAttempt(string correctWord, string userInput)
        {
            TotalCount++;
            if (userInput.Equals(correctWord, StringComparison.OrdinalIgnoreCase))
            {
                CorrectCount++;
            }
            else
            {
                _wrongWords.Add($"'{correctWord}' → 你输入: '{userInput}'");
            }
        }

        public IReadOnlyList<string> GetWrongWords() => _wrongWords;
    }
}
