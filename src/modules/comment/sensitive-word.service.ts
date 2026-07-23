import { Injectable } from '@nestjs/common';

interface TrieNode {
  children: Map<string, TrieNode>;
  isEnd: boolean;
}

@Injectable()
export class SensitiveWordService {
  private root: TrieNode = { children: new Map(), isEnd: false };
  private initialized = false;

  /**
   * Initialize the DFA trie with a list of sensitive words.
   * In production, these words would be loaded from a database or config.
   */
  initialize(words: string[]): void {
    this.root = { children: new Map(), isEnd: false };
    for (const word of words) {
      this.insert(word);
    }
    this.initialized = true;
  }

  private insert(word: string): void {
    let node = this.root;
    for (const char of word) {
      if (!node.children.has(char)) {
        node.children.set(char, { children: new Map(), isEnd: false });
      }
      const next = node.children.get(char);
      if (!next) break;
      node = next;
    }
    node.isEnd = true;
  }

  /**
   * Check if text contains any sensitive word using DFA.
   * Returns the first matched word, or null if clean.
   */
  containsSensitiveWord(text: string): string | null {
    if (!this.initialized) return null;

    for (let i = 0; i < text.length; i++) {
      let node = this.root;
      for (let j = i; j < text.length; j++) {
        const next = node.children.get(text[j]);
        if (!next) break;
        node = next;
        if (node.isEnd) {
          return text.substring(i, j + 1);
        }
      }
    }
    return null;
  }

  /**
   * Set the comment to pending status if sensitive words are detected.
   * Returns true if the content should be pending (sensitive words found).
   */
  shouldPendingReview(text: string): boolean {
    return this.containsSensitiveWord(text) !== null;
  }
}
