#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
控制台打字游戏 - Python版本
适合工作摸鱼的极简UI
"""

import random
import time
import sys

WORDS = [
    "print", "input", "def", "return", "if", "else", "elif", "for", "while",
    "class", "import", "from", "as", "try", "except", "finally", "with",
    "lambda", "yield", "range", "len", "str", "int", "list", "dict",
    "public", "private", "static", "void", "extends", "implements",
    "interface", "package", "new", "this", "super", "null", "true", "false",
    "include", "stdio", "stdlib", "char", "float", "double", "struct",
    "sizeof", "malloc", "free", "const", "pointer", "reference",
    "namespace", "using", "var", "dynamic", "async", "await", "get", "set",
    "variable", "function", "method", "parameter", "argument",
    "array", "string", "boolean", "loop", "condition", "recursion", "algorithm",
    "debug", "compile", "runtime", "syntax", "semantic", "exception",
    "git", "commit", "push", "pull", "merge", "branch", "repository",
    "api", "rest", "json", "xml", "http", "database", "query", "server",
    "frontend", "backend", "fullstack", "framework", "library", "module"
]


def clear_screen():
    print("\n" * 50)


def print_header():
    print("=" * 50)
    print("  控制台打字游戏 - Python版")
    print("=" * 50)
    print()


def get_difficulty():
    print("选择难度:")
    print("  1. 简单 (60秒, 简单词汇)")
    print("  2. 中等 (60秒, 混合词汇)")
    print("  3. 困难 (45秒, 复杂词汇)")
    print()
    
    while True:
        choice = input("输入数字 (1-3): ").strip()
        if choice == "1":
            return 60, [w for w in WORDS if len(w) <= 5]
        elif choice == "2":
            return 60, WORDS
        elif choice == "3":
            return 45, [w for w in WORDS if len(w) >= 6]
        else:
            print("无效输入，请重新选择")


def play_game(time_limit, word_pool):
    clear_screen()
    print_header()
    
    print(f"时间限制: {time_limit}秒")
    print(f"词汇数量: {len(word_pool)}")
    print("规则: 输入显示的单词，按Enter确认")
    print("准备开始...")
    input("\n按Enter键开始!")
    
    clear_screen()
    start_time = time.time()
    correct_count = 0
    total_count = 0
    wrong_words = []
    
    while time.time() - start_time < time_limit:
        word = random.choice(word_pool)
        time_left = int(time_limit - (time.time() - start_time))
        
        print(f"\n[剩余时间: {time_left}秒 | 正确: {correct_count} | 已输入: {total_count}]")
        print(f"单词: {word}")
        
        user_input = input("> ").strip()
        
        if not user_input:
            continue
            
        total_count += 1
        
        if user_input.lower() == word.lower():
            correct_count += 1
            print("✓ 正确!")
        else:
            wrong_words.append((word, user_input))
            print(f"✗ 错误! 正确答案是: {word}")
    
    return correct_count, total_count, wrong_words


def show_results(correct, total, wrong_words):
    clear_screen()
    print_header()
    
    print("游戏结束!")
    print("=" * 50)
    print(f"正确: {correct} / {total}")
    
    if total > 0:
        accuracy = (correct / total) * 100
        print(f"准确率: {accuracy:.1f}%")
    else:
        print("准确率: 0%")
    
    if wrong_words:
        print("\n错误记录:")
        for i, (correct_word, user_word) in enumerate(wrong_words[:10], 1):
            print(f"  {i}. '{correct_word}' → 你输入: '{user_word}'")
        if len(wrong_words) > 10:
            print(f"  ... 还有 {len(wrong_words) - 10} 个错误")
    
    if total > 0:
        accuracy = correct / total
        if accuracy >= 0.95 and correct >= 20:
            print("\n🏆 评级: 代码大神!")
        elif accuracy >= 0.8 and correct >= 15:
            print("\n⭐ 评级: 优秀程序员!")
        elif accuracy >= 0.6:
            print("\n👍 评级: 还在进步!")
        else:
            print("\n💪 评级: 继续练习!")
    
    print()


def main():
    while True:
        clear_screen()
        print_header()
        
        time_limit, word_pool = get_difficulty()
        correct, total, wrong_words = play_game(time_limit, word_pool)
        show_results(correct, total, wrong_words)
        
        play_again = input("再玩一次? (y/n): ").strip().lower()
        if play_again != 'y':
            print("\n感谢游玩! 继续搬砖...")
            break


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n游戏已退出")
        sys.exit(0)
