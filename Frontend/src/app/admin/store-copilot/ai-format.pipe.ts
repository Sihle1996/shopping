import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Renders the AI's markdown-ish text as clean, safe HTML — real tables, lists,
 * bold and headings — for the copilot chat and briefing. Strips emojis. Input
 * is HTML-escaped before any formatting, so it's safe to bind with innerHTML.
 */
@Pipe({ name: 'aiFormat' })
export class AiFormatPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(raw: string | null | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.toHtml((raw || '').toString()));
  }

  /**
   * Escape every HTML-significant char (incl. quotes) BEFORE any formatting.
   * inline() output is only ever placed as element text, never inside an
   * attribute — escaping quotes too keeps it safe even if that ever changes.
   */
  private esc(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private stripEmoji(s: string): string {
    return s
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, '')
      .replace(/[ \t]{2,}/g, ' ');
  }

  /** Inline formatting: bold, italic, code. Escapes HTML first. */
  private inline(s: string): string {
    let t = this.esc(s);
    t = t.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
    t = t.replace(/`([^`]+?)`/g, '<code class="ai-code">$1</code>');
    return t;
  }

  private toHtml(input: string): string {
    const lines = this.stripEmoji(input).replace(/\r/g, '').split('\n');
    let html = '';
    let i = 0;
    let listOpen: 'ul' | 'ol' | null = null;
    const closeList = () => { if (listOpen) { html += `</${listOpen}>`; listOpen = null; } };

    while (i < lines.length) {
      const trimmed = lines[i].trim();

      // Table: a row of pipes followed by a |---|---| separator line.
      if (/^\|?.*\|.*$/.test(trimmed) && trimmed.includes('|') &&
          i + 1 < lines.length && /^\|?[\s:|-]*-[\s:|-]*$/.test(lines[i + 1].trim())) {
        closeList();
        const header = this.splitRow(trimmed);
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
          rows.push(this.splitRow(lines[i].trim()));
          i++;
        }
        html += this.renderTable(header, rows);
        continue;
      }

      if (trimmed === '') { closeList(); i++; continue; }

      const h = trimmed.match(/^(#{1,4})\s+(.*)$/);
      if (h) { closeList(); html += `<p class="ai-h">${this.inline(h[2])}</p>`; i++; continue; }

      const b = trimmed.match(/^[-*•]\s+(.*)$/);
      if (b) {
        if (listOpen !== 'ul') { closeList(); html += '<ul class="ai-ul">'; listOpen = 'ul'; }
        html += `<li>${this.inline(b[1])}</li>`; i++; continue;
      }

      const n = trimmed.match(/^\d+[.)]\s+(.*)$/);
      if (n) {
        if (listOpen !== 'ol') { closeList(); html += '<ol class="ai-ol">'; listOpen = 'ol'; }
        html += `<li>${this.inline(n[1])}</li>`; i++; continue;
      }

      closeList();
      html += `<p>${this.inline(trimmed)}</p>`;
      i++;
    }
    closeList();
    return html;
  }

  private splitRow(row: string): string[] {
    let r = row.trim();
    if (r.startsWith('|')) r = r.slice(1);
    if (r.endsWith('|')) r = r.slice(0, -1);
    return r.split('|').map(c => c.trim());
  }

  private renderTable(header: string[], rows: string[][]): string {
    let h = '<div class="ai-table-wrap"><table class="ai-table"><thead><tr>';
    header.forEach(c => h += `<th>${this.inline(c)}</th>`);
    h += '</tr></thead><tbody>';
    rows.forEach(r => {
      h += '<tr>';
      r.forEach(c => h += `<td>${this.inline(c)}</td>`);
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }
}
