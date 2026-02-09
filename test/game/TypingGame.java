import java.util.Scanner;
import java.util.List;
import java.util.ArrayList;
import java.util.Random;

public class TypingGame {
    
    private static final String[] WORDS = {
        "public", "private", "static", "void", "class", "extends", "implements",
        "interface", "package", "import", "new", "this", "super", "null", "true", "false",
        "String", "Integer", "ArrayList", "HashMap", "System", "println", "Scanner",
        "print", "input", "def", "return", "if", "else", "elif", "for", "while",
        "try", "catch", "finally", "throw", "throws", "abstract", "final",
        "variable", "function", "method", "parameter", "argument", "return",
        "array", "loop", "condition", "recursion", "algorithm",
        "debug", "compile", "runtime", "syntax", "exception",
        "git", "commit", "push", "pull", "merge", "branch",
        "api", "json", "database", "server", "frontend", "backend"
    };
    
    private Scanner scanner;
    private Random random;
    private GameStats stats;
    
    public TypingGame() {
        this.scanner = new Scanner(System.in);
        this.random = new Random();
        this.stats = new GameStats();
    }
    
    public void start() {
        while (true) {
            clearScreen();
            printHeader();
            
            DifficultySettings settings = selectDifficulty();
            playGame(settings);
            showResults();
            
            System.out.print("\n再玩一次? (y/n): ");
            String choice = scanner.nextLine().trim().toLowerCase();
            if (!choice.equals("y")) {
                System.out.println("\n感谢游玩! 继续搬砖...");
                break;
            }
        }
    }
    
    private void clearScreen() {
        for (int i = 0; i < 50; i++) {
            System.out.println();
        }
    }
    
    private void printHeader() {
        System.out.println("==================================================");
        System.out.println("  控制台打字游戏 - Java版 (面向对象版)");
        System.out.println("==================================================");
        System.out.println();
    }
    
    private DifficultySettings selectDifficulty() {
        System.out.println("选择难度:");
        System.out.println("  1. 简单 (60秒, 短词汇)");
        System.out.println("  2. 中等 (60秒, 全部词汇)");
        System.out.println("  3. 困难 (45秒, 长词汇)");
        System.out.println();
        
        while (true) {
            System.out.print("输入数字 (1-3): ");
            String choice = scanner.nextLine().trim();
            
            switch (choice) {
                case "1":
                    return new DifficultySettings(60, getShortWords());
                case "2":
                    return new DifficultySettings(60, WORDS);
                case "3":
                    return new DifficultySettings(45, getLongWords());
                default:
                    System.out.println("无效输入，请重新选择");
            }
        }
    }
    
    private String[] getShortWords() {
        List<String> shortWords = new ArrayList<>();
        for (String word : WORDS) {
            if (word.length() <= 5) {
                shortWords.add(word);
            }
        }
        return shortWords.toArray(new String[0]);
    }
    
    private String[] getLongWords() {
        List<String> longWords = new ArrayList<>();
        for (String word : WORDS) {
            if (word.length() >= 6) {
                longWords.add(word);
            }
        }
        return longWords.toArray(new String[0]);
    }
    
    private void playGame(DifficultySettings settings) {
        clearScreen();
        printHeader();
        
        System.out.println("时间限制: " + settings.getTimeLimit() + "秒");
        System.out.println("词汇数量: " + settings.getWordPool().length);
        System.out.println("规则: 输入显示的单词，按Enter确认");
        System.out.println("准备开始...");
        System.out.print("\n按Enter键开始!");
        scanner.nextLine();
        
        clearScreen();
        long startTime = System.currentTimeMillis();
        stats.reset();
        
        while (System.currentTimeMillis() - startTime < settings.getTimeLimit() * 1000) {
            String word = settings.getRandomWord(random);
            long timeLeft = settings.getTimeLimit() - 
                (System.currentTimeMillis() - startTime) / 1000;
            
            System.out.println("\n[剩余时间: " + timeLeft + "秒 | 正确: " + 
                stats.getCorrectCount() + " | 已输入: " + stats.getTotalCount() + "]");
            System.out.println("单词: " + word);
            System.out.print("> ");
            
            String userInput = scanner.nextLine().trim();
            
            if (userInput.isEmpty()) {
                continue;
            }
            
            stats.recordAttempt(word, userInput);
            
            if (userInput.equalsIgnoreCase(word)) {
                System.out.println("✓ 正确!");
            } else {
                System.out.println("✗ 错误! 正确答案是: " + word);
            }
        }
    }
    
    private void showResults() {
        clearScreen();
        printHeader();
        
        System.out.println("游戏结束!");
        System.out.println("==================================================");
        System.out.println("正确: " + stats.getCorrectCount() + " / " + stats.getTotalCount());
        System.out.printf("准确率: %.1f%%\n", stats.getAccuracy() * 100);
        
        List<String> wrongWords = stats.getWrongWords();
        if (!wrongWords.isEmpty()) {
            System.out.println("\n错误记录:");
            int displayCount = Math.min(wrongWords.size(), 10);
            for (int i = 0; i < displayCount; i++) {
                System.out.println("  " + (i + 1) + ". " + wrongWords.get(i));
            }
            if (wrongWords.size() > 10) {
                System.out.println("  ... 还有 " + (wrongWords.size() - 10) + " 个错误");
            }
        }
        
        System.out.println();
        if (stats.getAccuracy() >= 0.95 && stats.getCorrectCount() >= 20) {
            System.out.println("🏆 评级: 代码大神!");
        } else if (stats.getAccuracy() >= 0.8 && stats.getCorrectCount() >= 15) {
            System.out.println("⭐ 评级: 优秀程序员!");
        } else if (stats.getAccuracy() >= 0.6) {
            System.out.println("👍 评级: 还在进步!");
        } else {
            System.out.println("💪 评级: 继续练习!");
        }
        System.out.println();
    }
    
    public static void main(String[] args) {
        TypingGame game = new TypingGame();
        game.start();
    }
}

class DifficultySettings {
    private int timeLimit;
    private String[] wordPool;
    
    public DifficultySettings(int timeLimit, String[] wordPool) {
        this.timeLimit = timeLimit;
        this.wordPool = wordPool;
    }
    
    public int getTimeLimit() {
        return timeLimit;
    }
    
    public String[] getWordPool() {
        return wordPool;
    }
    
    public String getRandomWord(Random random) {
        return wordPool[random.nextInt(wordPool.length)];
    }
}

class GameStats {
    private int correctCount;
    private int totalCount;
    private List<String> wrongWords;
    
    public GameStats() {
        this.wrongWords = new ArrayList<>();
    }
    
    public void reset() {
        correctCount = 0;
        totalCount = 0;
        wrongWords.clear();
    }
    
    public void recordAttempt(String correctWord, String userInput) {
        totalCount++;
        if (userInput.equalsIgnoreCase(correctWord)) {
            correctCount++;
        } else {
            wrongWords.add("'" + correctWord + "' → 你输入: '" + userInput + "'");
        }
    }
    
    public int getCorrectCount() {
        return correctCount;
    }
    
    public int getTotalCount() {
        return totalCount;
    }
    
    public double getAccuracy() {
        return totalCount > 0 ? (double) correctCount / totalCount : 0.0;
    }
    
    public List<String> getWrongWords() {
        return wrongWords;
    }
}
