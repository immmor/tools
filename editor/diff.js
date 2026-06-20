class FileDiffManager {
    constructor() {
        this.originalContents = {};
        this.decorations = {};
    }

    setOriginalContent(fileName, content) {
        this.originalContents[fileName] = content;
    }

    getOriginalContent(fileName) {
        return this.originalContents[fileName] || '';
    }

    clearOriginalContent(fileName) {
        delete this.originalContents[fileName];
        this.clearDecorations(fileName);
    }

    computeDiff(original, current) {
        const originalLines = original.split('\n');
        const currentLines = current.split('\n');
        
        const diff = {
            added: new Set(),
            removed: new Set(),
            modified: new Set()
        };

        const maxLen = Math.max(originalLines.length, currentLines.length);
        
        for (let i = 0; i < maxLen; i++) {
            const origLine = originalLines[i] || '';
            const currLine = currentLines[i] || '';
            
            if (origLine === '' && currLine !== '') {
                diff.added.add(i + 1);
            } else if (origLine !== '' && currLine === '') {
                diff.removed.add(i + 1);
            } else if (origLine !== currLine) {
                diff.modified.add(i + 1);
            }
        }
        
        return diff;
    }

    updateDecorations(fileName, editor) {
        if (!editor || !editor.deltaDecorations) return;
        
        const original = this.getOriginalContent(fileName);
        const current = editor.getValue ? editor.getValue() : (editor.value || '');
        
        const diff = this.computeDiff(original, current);
        
        const decorationOptions = [];
        
        diff.added.forEach(line => {
            decorationOptions.push({
                range: new monaco.Range(line, 1, line, 1),
                options: {
                    isWholeLine: true,
                    className: 'diff-added',
                    glyphMarginClassName: 'diff-glyph-added'
                }
            });
        });
        
        diff.modified.forEach(line => {
            decorationOptions.push({
                range: new monaco.Range(line, 1, line, 1),
                options: {
                    isWholeLine: true,
                    className: 'diff-modified',
                    glyphMarginClassName: 'diff-glyph-modified'
                }
            });
        });
        
        const oldDecorations = this.decorations[fileName] || [];
        this.decorations[fileName] = editor.deltaDecorations(oldDecorations, decorationOptions);
        
        return diff;
    }

    clearDecorations(fileName) {
        if (this.decorations[fileName]) {
            delete this.decorations[fileName];
        }
    }

    hasChanges(fileName, editor) {
        if (!editor) return false;
        
        const original = this.getOriginalContent(fileName);
        const current = editor.getValue ? editor.getValue() : (editor.value || '');
        
        return original !== current;
    }

    getChangeCount(fileName, editor) {
        if (!editor) return { added: 0, removed: 0, modified: 0 };
        
        const original = this.getOriginalContent(fileName);
        const current = editor.getValue ? editor.getValue() : (editor.value || '');
        
        const diff = this.computeDiff(original, current);
        
        return {
            added: diff.added.size,
            removed: diff.removed.size,
            modified: diff.modified.size
        };
    }

    showDiffPanel(fileName, editor) {
        const original = this.getOriginalContent(fileName);
        const current = editor.getValue ? editor.getValue() : (editor.value || '');
        
        const diff = this.computeDiff(original, current);
        
        let diffHtml = '<div class="diff-panel">';
        diffHtml += '<div class="diff-header">';
        diffHtml += '<span class="diff-title">CHANGES</span>';
        diffHtml += `<span class="diff-stats">+${diff.added.size} ~${diff.modified.size} -${diff.removed.size}</span>`;
        diffHtml += '</div>';
        
        const originalLines = original.split('\n');
        const currentLines = current.split('\n');
        
        diffHtml += '<div class="diff-content">';
        
        let origIdx = 0;
        let currIdx = 0;
        
        while (origIdx < originalLines.length || currIdx < currentLines.length) {
            const origLine = originalLines[origIdx] || '';
            const currLine = currentLines[currIdx] || '';
            
            if (origLine === currLine) {
                diffHtml += `<div class="diff-line diff-unchanged">`;
                diffHtml += `<span class="diff-num">${origIdx + 1}</span>`;
                diffHtml += `<span class="diff-num">${currIdx + 1}</span>`;
                diffHtml += `<span class="diff-text">${this.escapeHtml(origLine) || '&nbsp;'}</span>`;
                diffHtml += '</div>';
                origIdx++;
                currIdx++;
            } else if (!origLine) {
                diffHtml += `<div class="diff-line diff-added-line">`;
                diffHtml += `<span class="diff-num"></span>`;
                diffHtml += `<span class="diff-num diff-num-added">+${currIdx + 1}</span>`;
                diffHtml += `<span class="diff-text diff-text-added">+ ${this.escapeHtml(currLine) || '&nbsp;'}</span>`;
                diffHtml += '</div>';
                currIdx++;
            } else if (!currLine) {
                diffHtml += `<div class="diff-line diff-removed-line">`;
                diffHtml += `<span class="diff-num diff-num-removed">-${origIdx + 1}</span>`;
                diffHtml += `<span class="diff-num"></span>`;
                diffHtml += `<span class="diff-text diff-text-removed">- ${this.escapeHtml(origLine) || '&nbsp;'}</span>`;
                diffHtml += '</div>';
                origIdx++;
            } else {
                diffHtml += `<div class="diff-line diff-removed-line">`;
                diffHtml += `<span class="diff-num diff-num-removed">-${origIdx + 1}</span>`;
                diffHtml += `<span class="diff-num"></span>`;
                diffHtml += `<span class="diff-text diff-text-removed">- ${this.escapeHtml(origLine) || '&nbsp;'}</span>`;
                diffHtml += '</div>';
                
                diffHtml += `<div class="diff-line diff-added-line">`;
                diffHtml += `<span class="diff-num"></span>`;
                diffHtml += `<span class="diff-num diff-num-added">+${currIdx + 1}</span>`;
                diffHtml += `<span class="diff-text diff-text-added">+ ${this.escapeHtml(currLine) || '&nbsp;'}</span>`;
                diffHtml += '</div>';
                
                origIdx++;
                currIdx++;
            }
        }
        
        diffHtml += '</div>';
        diffHtml += '</div>';
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="custom-modal" style="width: 80%; max-width: 1000px; max-height: 80vh; overflow: hidden;">
                <div class="p-head">
                    <span id="modal-title">DIFF VIEW - ${fileName}</span>
                    <div class="ctrl-group">
                        <span class="ctrl" onclick="this.closest('.modal-overlay').remove()" title="CLOSE">×</span>
                    </div>
                </div>
                <div class="modal-body" id="modal-content" style="padding: 0; overflow: auto; max-height: calc(80vh - 30px);">
                    ${diffHtml}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

const fileDiffManager = new FileDiffManager();

window.fileDiffManager = fileDiffManager;
