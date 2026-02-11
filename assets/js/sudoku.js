// ============================================
// 数独游戏核心类
// ============================================

class SudokuGame {
    constructor() {
        this.board = Array(81).fill(0);
        this.solution = Array(81).fill(0);
        this.initialBoard = Array(81).fill(0);
        this.selectedCell = null;
        this.notes = Array(81).fill(null).map(() => new Set());
        this.notesMode = false;
        this.timer = 0;
        this.timerInterval = null;
        this.isPaused = false;
        this.difficulty = 'medium';
        this.errors = 0;
        this.maxErrors = 3;
        this.hintsRemaining = 3;
        this.history = [];
        
        this.init();
    }

    init() {
        this.renderBoard();
        this.renderNumberPad();
        this.loadStats();
        this.loadAutoSave();
        this.setupKeyboardControls();
        
        // 如果没有自动保存，显示新游戏对话框
        if (!this.hasAutoSave()) {
            this.newGame();
        }
    }

    // ============================================
    // 棋盘渲染
    // ============================================

    renderBoard() {
        const boardEl = document.getElementById('board');
        boardEl.innerHTML = '';
        
        for (let i = 0; i < 81; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.setAttribute('data-index', i);
            cell.setAttribute('role', 'gridcell');
            cell.setAttribute('tabindex', '0');
            cell.setAttribute('aria-label', `第${Math.floor(i/9)+1}行第${(i%9)+1}列`);
            
            cell.addEventListener('click', () => this.selectCell(i));
            cell.addEventListener('keydown', (e) => this.handleCellKeydown(e, i));
            
            boardEl.appendChild(cell);
        }
        
        this.updateBoard();
    }

    updateBoard() {
        for (let i = 0; i < 81; i++) {
            const cell = document.querySelector(`[data-index="${i}"]`);
            const value = this.board[i];
            const isFixed = this.initialBoard[i] !== 0;
            
            cell.className = 'cell';
            if (isFixed) cell.classList.add('fixed');
            if (this.selectedCell === i) cell.classList.add('selected');
            
            // 高亮相同数字
            if (value !== 0 && this.selectedCell !== null && 
                this.board[this.selectedCell] === value) {
                cell.classList.add('same-number');
            }
            
            // 显示数字或笔记
            if (value !== 0) {
                cell.textContent = value;
                cell.innerHTML = value;
            } else if (this.notes[i].size > 0) {
                const notesHtml = Array(9).fill(0).map((_, idx) => 
                    this.notes[i].has(idx + 1) ? `<span>${idx + 1}</span>` : '<span></span>'
                ).join('');
                cell.innerHTML = `<div class="cell-notes">${notesHtml}</div>`;
            } else {
                cell.textContent = '';
            }
        }
        
        this.updateRemainingNumbers();
    }

    renderNumberPad() {
        const padEl = document.querySelector('.number-pad');
        padEl.innerHTML = '';
        
        for (let i = 1; i <= 9; i++) {
            const btn = document.createElement('button');
            btn.className = 'number-btn';
            btn.textContent = i;
            btn.setAttribute('data-number', i);
            btn.setAttribute('aria-label', `数字 ${i}`);
            btn.onclick = () => this.inputNumber(i);
            padEl.appendChild(btn);
        }
        
        // 删除按钮
        const delBtn = document.createElement('button');
        delBtn.className = 'number-btn';
        delBtn.innerHTML = '❌';
        delBtn.setAttribute('aria-label', '删除');
        delBtn.onclick = () => this.inputNumber(0);
        padEl.appendChild(delBtn);
    }

    updateRemainingNumbers() {
        for (let num = 1; num <= 9; num++) {
            const count = this.board.filter(v => v === num).length;
            const remaining = 9 - count;
            const btn = document.querySelector(`[data-number="${num}"]`);
            if (btn) {
                const existingSpan = btn.querySelector('.remaining');
                if (existingSpan) existingSpan.remove();
                
                if (remaining < 9) {
                    const span = document.createElement('span');
                    span.className = 'remaining';
                    span.textContent = remaining;
                    btn.appendChild(span);
                }
                
                if (remaining === 0) {
                    btn.disabled = true;
                    btn.style.opacity = '0.3';
                } else {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
            }
        }
    }

    // ============================================
    // 用户交互
    // ============================================

    selectCell(index) {
        if (this.isPaused) return;
        if (this.initialBoard[index] !== 0) return; // 不能选择固定数字
        
        this.selectedCell = index;
        this.updateBoard();
    }

    inputNumber(num) {
        if (this.isPaused || this.selectedCell === null) return;
        if (this.initialBoard[this.selectedCell] !== 0) return;
        
        const oldValue = this.board[this.selectedCell];
        
        if (this.notesMode) {
            // 笔记模式
            if (num === 0) {
                this.notes[this.selectedCell].clear();
            } else {
                if (this.notes[this.selectedCell].has(num)) {
                    this.notes[this.selectedCell].delete(num);
                } else {
                    this.notes[this.selectedCell].add(num);
                }
            }
        } else {
            // 正常输入模式
            this.history.push({
                index: this.selectedCell,
                oldValue: oldValue,
                newValue: num,
                notes: new Set(this.notes[this.selectedCell])
            });
            
            this.board[this.selectedCell] = num;
            this.notes[this.selectedCell].clear();
            
            if (num !== 0 && num !== this.solution[this.selectedCell]) {
                this.errors++;
                this.updateErrorsDisplay();
                
                const cell = document.querySelector(`[data-index="${this.selectedCell}"]`);
                cell.classList.add('error');
                setTimeout(() => cell.classList.remove('error'), 500);
                
                if (this.errors >= this.maxErrors) {
                    this.gameOver();
                }
            }
        }
        
        this.updateBoard();
        this.autoSave();
        this.checkWin();
    }

    undoMove() {
        if (this.history.length === 0) return;
        
        const move = this.history.pop();
        this.board[move.index] = move.oldValue;
        this.notes[move.index] = new Set(move.notes);
        
        this.updateBoard();
        this.autoSave();
    }

    toggleNotes() {
        this.notesMode = !this.notesMode;
        const btn = document.getElementById('notesBtn');
        if (this.notesMode) {
            btn.classList.add('active');
            btn.style.background = 'var(--primary-color)';
            btn.style.color = 'white';
        } else {
            btn.classList.remove('active');
            btn.style.background = '';
            btn.style.color = '';
        }
    }

    // ============================================
    // 键盘控制
    // ============================================

    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            if (this.isPaused) return;
            
            if (e.key >= '1' && e.key <= '9') {
                e.preventDefault();
                this.inputNumber(parseInt(e.key));
            } else if (e.key === 'Delete' || e.key === 'Backspace' || e.key === '0') {
                e.preventDefault();
                this.inputNumber(0);
            } else if (e.key === 'n' && e.altKey) {
                e.preventDefault();
                this.newGame();
            } else if (e.key === 'h' && e.altKey) {
                e.preventDefault();
                this.getHint();
            }
        });
    }

    handleCellKeydown(e, index) {
        const row = Math.floor(index / 9);
        const col = index % 9;
        
        switch(e.key) {
            case 'ArrowUp':
                e.preventDefault();
                if (row > 0) this.selectCell(index - 9);
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (row < 8) this.selectCell(index + 9);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (col > 0) this.selectCell(index - 1);
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (col < 8) this.selectCell(index + 1);
                break;
        }
    }

    // ============================================
    // 数独生成算法
    // ============================================

    generateSudoku(difficulty) {
        // 生成完整的解决方案
        this.solution = this.generateCompleteSudoku();
        
        // 根据难度移除数字
        const cluesMap = {
            easy: { min: 40, max: 45 },
            medium: { min: 30, max: 35 },
            hard: { min: 25, max: 30 },
            expert: { min: 20, max: 25 }
        };
        
        const { min, max } = cluesMap[difficulty];
        const clues = Math.floor(Math.random() * (max - min + 1)) + min;
        
        this.board = [...this.solution];
        this.initialBoard = Array(81).fill(0);
        
        // 随机选择要保留的单元格
        const indices = Array(81).fill(0).map((_, i) => i);
        this.shuffleArray(indices);
        
        for (let i = 0; i < clues; i++) {
            this.initialBoard[indices[i]] = this.solution[indices[i]];
        }
        
        this.board = [...this.initialBoard];
    }

    generateCompleteSudoku() {
        const board = Array(81).fill(0);
        
        // 填充对角线的3个3x3方格
        for (let box = 0; box < 3; box++) {
            const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
            this.shuffleArray(nums);
            
            for (let i = 0; i < 9; i++) {
                const row = box * 3 + Math.floor(i / 3);
                const col = box * 3 + (i % 3);
                board[row * 9 + col] = nums[i];
            }
        }
        
        // 填充剩余单元格
        this.solveSudoku(board);
        return board;
    }

    solveSudoku(board) {
        const emptyCell = board.indexOf(0);
        if (emptyCell === -1) return true; // 已完成
        
        const row = Math.floor(emptyCell / 9);
        const col = emptyCell % 9;
        
        const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        this.shuffleArray(nums);
        
        for (const num of nums) {
            if (this.isValid(board, row, col, num)) {
                board[emptyCell] = num;
                if (this.solveSudoku(board)) return true;
                board[emptyCell] = 0;
            }
        }
        
        return false;
    }

    isValid(board, row, col, num) {
        // 检查行
        for (let c = 0; c < 9; c++) {
            if (board[row * 9 + c] === num) return false;
        }
        
        // 检查列
        for (let r = 0; r < 9; r++) {
            if (board[r * 9 + col] === num) return false;
        }
        
        // 检查3x3方格
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                if (board[(boxRow + r) * 9 + (boxCol + c)] === num) return false;
            }
        }
        
        return true;
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // ============================================
    // 游戏控制
    // ============================================

    newGame() {
        this.showModal('newGameModal');
    }

    startNewGame(difficulty) {
        this.difficulty = difficulty;
        this.errors = 0;
        this.timer = 0;
        this.hintsRemaining = 100;
        this.history = [];
        this.notes = Array(81).fill(null).map(() => new Set());
        this.notesMode = false;
        this.isPaused = false;
        
        this.generateSudoku(difficulty);
        this.updateBoard();
        this.updateDifficultyDisplay();
        this.updateErrorsDisplay();
        this.updateHintsDisplay();
        this.startTimer();
        this.closeModal('newGameModal');
        this.autoSave();
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const btn = document.getElementById('pauseBtn');
        
        if (this.isPaused) {
            this.stopTimer();
            btn.innerHTML = '<span>▶️</span> 继续';
            document.getElementById('board').style.filter = 'blur(10px)';
        } else {
            this.startTimer();
            btn.innerHTML = '<span>⏸️</span> 暂停';
            document.getElementById('board').style.filter = '';
        }
    }

    getHint() {
        if (this.hintsRemaining <= 0) {
            alert('提示次数已用完！');
            return;
        }
        
        if (this.selectedCell === null) {
            // 找一个空单元格
            for (let i = 0; i < 81; i++) {
                if (this.board[i] === 0) {
                    this.selectCell(i);
                    break;
                }
            }
        }
        
        if (this.selectedCell !== null && this.board[this.selectedCell] === 0) {
            this.board[this.selectedCell] = this.solution[this.selectedCell];
            this.initialBoard[this.selectedCell] = this.solution[this.selectedCell];
            this.hintsRemaining--;
            this.updateHintsDisplay();
            this.updateBoard();
            this.checkWin();
            this.autoSave();
        }
    }

    checkErrors() {
        let hasErrors = false;
        for (let i = 0; i < 81; i++) {
            const cell = document.querySelector(`[data-index="${i}"]`);
            cell.classList.remove('error');
            
            if (this.board[i] !== 0 && this.board[i] !== this.solution[i]) {
                cell.classList.add('error');
                hasErrors = true;
            }
        }
        
        if (!hasErrors) {
            alert('✅ 太棒了！目前没有错误！');
        } else {
            alert('❌ 发现错误！已用红色标记。');
        }
    }

    checkWin() {
        for (let i = 0; i < 81; i++) {
            if (this.board[i] !== this.solution[i]) return false;
        }
        
        this.stopTimer();
        this.saveStats();
        this.showWinModal();
        return true;
    }

    gameOver() {
        this.stopTimer();
        alert('❌ 游戏结束！错误次数过多。\n\n点击"新游戏"重新开始。');
    }

    // ============================================
    // 计时器
    // ============================================

    startTimer() {
        if (this.timerInterval) return;
        
        this.timerInterval = setInterval(() => {
            this.timer++;
            this.updateTimerDisplay();
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timer / 60);
        const seconds = this.timer % 60;
        document.getElementById('timer').textContent = 
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    updateDifficultyDisplay() {
        const displayEl = document.getElementById('difficulty-display');
        const difficultyMap = {
            easy: { text: '简单', class: 'difficulty-easy' },
            medium: { text: '中等', class: 'difficulty-medium' },
            hard: { text: '困难', class: 'difficulty-hard' },
            expert: { text: '专家', class: 'difficulty-expert' }
        };
        
        const { text, class: className } = difficultyMap[this.difficulty];
        displayEl.textContent = text;
        displayEl.className = 'difficulty-badge ' + className;
    }

    updateErrorsDisplay() {
        document.getElementById('errors-display').textContent = `${this.errors} / ${this.maxErrors}`;
    }

    updateHintsDisplay() {
        document.getElementById('hints-display').textContent = this.hintsRemaining;
    }

    // ============================================
    // 统计功能
    // ============================================

    loadStats() {
        const stats = localStorage.getItem('sudoku-stats');
        this.stats = stats ? JSON.parse(stats) : {
            gamesPlayed: 0,
            gamesWon: 0,
            bestTimes: { easy: Infinity, medium: Infinity, hard: Infinity, expert: Infinity },
            totalTime: 0
        };
    }

    saveStats() {
        this.stats.gamesPlayed++;
        this.stats.gamesWon++;
        this.stats.totalTime += this.timer;
        
        if (this.timer < this.stats.bestTimes[this.difficulty]) {
            this.stats.bestTimes[this.difficulty] = this.timer;
        }
        
        localStorage.setItem('sudoku-stats', JSON.stringify(this.stats));
    }

    showStats() {
        const formatTime = (seconds) => {
            if (seconds === Infinity) return '--:--';
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        };
        
        const statsHtml = `
            <div class="stat-card">
                <div class="stat-value">${this.stats.gamesPlayed}</div>
                <div class="stat-label">总游戏数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${this.stats.gamesWon}</div>
                <div class="stat-label">胜利次数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${formatTime(this.stats.bestTimes.easy)}</div>
                <div class="stat-label">简单最佳</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${formatTime(this.stats.bestTimes.medium)}</div>
                <div class="stat-label">中等最佳</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${formatTime(this.stats.bestTimes.hard)}</div>
                <div class="stat-label">困难最佳</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${formatTime(this.stats.bestTimes.expert)}</div>
                <div class="stat-label">专家最佳</div>
            </div>
        `;
        
        document.getElementById('statsContent').innerHTML = statsHtml;
        this.showModal('statsModal');
    }

    resetStats() {
        if (confirm('确定要重置所有统计数据吗？')) {
            localStorage.removeItem('sudoku-stats');
            this.loadStats();
            this.showStats();
        }
    }

    showWinModal() {
        const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        };
        
        const winHtml = `
            <div class="stat-card">
                <div class="stat-value">${formatTime(this.timer)}</div>
                <div class="stat-label">完成时间</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${this.difficulty}</div>
                <div class="stat-label">难度等级</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${this.errors}</div>
                <div class="stat-label">错误次数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${3 - this.hintsRemaining}</div>
                <div class="stat-label">使用提示</div>
            </div>
        `;
        
        document.getElementById('winStats').innerHTML = winHtml;
        this.showModal('winModal');
    }

    // ============================================
    // 保存/读取功能
    // ============================================

    autoSave() {
        const gameState = {
            board: this.board,
            solution: this.solution,
            initialBoard: this.initialBoard,
            notes: Array.from(this.notes, set => Array.from(set)),
            difficulty: this.difficulty,
            timer: this.timer,
            errors: this.errors,
            hintsRemaining: this.hintsRemaining,
            history: this.history,
            timestamp: Date.now()
        };
        
        localStorage.setItem('sudoku-autosave', JSON.stringify(gameState));
    }

    loadAutoSave() {
        const saved = localStorage.getItem('sudoku-autosave');
        if (!saved) return false;
        
        try {
            const gameState = JSON.parse(saved);
            this.board = gameState.board;
            this.solution = gameState.solution;
            this.initialBoard = gameState.initialBoard;
            this.notes = gameState.notes.map(arr => new Set(arr));
            this.difficulty = gameState.difficulty;
            this.timer = gameState.timer;
            this.errors = gameState.errors;
            this.hintsRemaining = gameState.hintsRemaining;
            this.history = gameState.history || [];
            
            this.updateBoard();
            this.updateDifficultyDisplay();
            this.updateErrorsDisplay();
            this.updateHintsDisplay();
            this.updateTimerDisplay();
            this.startTimer();
            
            return true;
        } catch (e) {
            console.error('Failed to load autosave:', e);
            return false;
        }
    }

    hasAutoSave() {
        return localStorage.getItem('sudoku-autosave') !== null;
    }

    showSaveLoad() {
        const slots = [];
        for (let i = 1; i <= 2; i++) {
            const saved = localStorage.getItem(`sudoku-save-${i}`);
            if (saved) {
                const data = JSON.parse(saved);
                const date = new Date(data.timestamp).toLocaleString('zh-CN');
                slots.push(`
                    <div style="display: flex; gap: 0.5rem; align-items: center; padding: 1rem; border: 2px solid var(--border-color); border-radius: 0.5rem;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600;">存档 ${i}</div>
                            <div style="font-size: 0.75rem; color: #64748b;">
                                ${data.difficulty} - ${date}
                            </div>
                        </div>
                        <button class="btn btn-secondary" style="padding: 0.5rem 1rem;" onclick="game.loadGame(${i})">读取</button>
                        <button class="btn btn-outline" style="padding: 0.5rem 1rem;" onclick="game.deleteGame(${i})">删除</button>
                    </div>
                `);
            } else {
                slots.push(`
                    <div style="display: flex; gap: 0.5rem; align-items: center; padding: 1rem; border: 2px dashed var(--border-color); border-radius: 0.5rem;">
                        <div style="flex: 1; color: #94a3b8;">存档 ${i} - 空</div>
                        <button class="btn btn-primary" style="padding: 0.5rem 1rem;" onclick="game.saveGame(${i})">保存</button>
                    </div>
                `);
            }
        }
        
        document.getElementById('saveSlots').innerHTML = slots.join('');
        this.showModal('saveLoadModal');
    }

    saveGame(slot) {
        const gameState = {
            board: this.board,
            solution: this.solution,
            initialBoard: this.initialBoard,
            notes: Array.from(this.notes, set => Array.from(set)),
            difficulty: this.difficulty,
            timer: this.timer,
            errors: this.errors,
            hintsRemaining: this.hintsRemaining,
            history: this.history,
            timestamp: Date.now()
        };
        
        localStorage.setItem(`sudoku-save-${slot}`, JSON.stringify(gameState));
        this.showSaveLoad();
    }

    loadGame(slot) {
        const saved = localStorage.getItem(`sudoku-save-${slot}`);
        if (!saved) return;
        
        try {
            const gameState = JSON.parse(saved);
            this.board = gameState.board;
            this.solution = gameState.solution;
            this.initialBoard = gameState.initialBoard;
            this.notes = gameState.notes.map(arr => new Set(arr));
            this.difficulty = gameState.difficulty;
            this.timer = gameState.timer;
            this.errors = gameState.errors;
            this.hintsRemaining = gameState.hintsRemaining;
            this.history = gameState.history || [];
            
            this.updateBoard();
            this.updateDifficultyDisplay();
            this.updateErrorsDisplay();
            this.updateHintsDisplay();
            this.updateTimerDisplay();
            this.startTimer();
            this.closeModal('saveLoadModal');
        } catch (e) {
            alert('读取存档失败！');
        }
    }

    deleteGame(slot) {
        if (confirm(`确定删除存档 ${slot} 吗？`)) {
            localStorage.removeItem(`sudoku-save-${slot}`);
            this.showSaveLoad();
        }
    }

    // ============================================
    // 打印功能
    // ============================================

    printPuzzle() {
        window.print();
    }

    // ============================================
    // 模态框控制
    // ============================================

    showModal(id) {
        document.getElementById(id).classList.add('active');
    }

    closeModal(id) {
        document.getElementById(id).classList.remove('active');
    }
}

// 初始化游戏
const game = new SudokuGame();
