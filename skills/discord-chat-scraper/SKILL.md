---
name: discord-chat-scraper
description: Use when you need to crawl or scrape long chat histories from Discord or other virtual scrolling apps using Playwright.
---
# Discord Chat Scraper Skill

This skill explains how to extract complete chat history from modern single-page applications like Discord, which use heavy virtual DOM rendering and strict pagination limits.

## The Problem
Apps like Discord remove older DOM elements as you scroll down, and only render elements visible on the screen. Furthermore, simple DOM scrolling (`scroller.scrollTop = 0`) will often get stuck after 1-2 months of message history because the app limits the continuous backfill buffer in a single page load.

## The Solution: Hybrid Scroll + Deep Linking

To successfully scrape the entire chat history without missing data, you must orchestrate a multi-pass process using Playwright (`browser_evaluate` and `browser_navigate`).

### Phase 1: Aggressive DOM Scrolling & Extraction

Use `browser_evaluate` to run a loop that simulates intense scrolling while constantly extracting messages. Since `window` context is preserved during a single page load, accumulate everything into a `window.__crawledMessages` Map to prevent duplicates.

**Scroll Tricks:**
You must trick the React virtual scroller. A simple `scrollTop = 0` isn't always enough. Combine multiple events:
1. `scroller.scrollTop = 0;`
2. `scroller.dispatchEvent(new WheelEvent('wheel', { deltaY: -1000, bubbles: true }));`
3. `scroller.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', code: 'PageUp', keyCode: 33, bubbles: true }));`

### Phase 2: Detecting the Stuck State

The script should track the ID of the oldest message visible (`li[class*="messageListItem_"]`). If this ID stops changing after multiple scroll attempts, you have hit the continuous scroll limit. 
Return the accumulated data and the `oldestId`.

### Phase 3: Deep Link Navigation (The Jump)

If you haven't reached the absolute beginning of the channel (e.g., you haven't found `div[class*="emptyChannelIcon_"]`), you must forcefully reset the DOM's pagination state.
1. Save the extracted data via a Python script to local storage (e.g., `messages.txt`).
2. Use Playwright `browser_navigate` to jump directly to the URL of the oldest message you just found: `https://discord.com/channels/{SERVER_ID}/{CHANNEL_ID}/{OLDEST_MESSAGE_ID}`.
3. This forces Discord to load the context *around* that old message, clearing the previous buffer limit!
4. Repeat Phase 1 from this new temporal anchor.

## Reference Script

Below is the standard `browser_evaluate` extraction block to run in Playwright:

```javascript
() => {
    return new Promise(async resolve => {
        window.__crawledMessages = window.__crawledMessages || new Map();
        
        const scroller = document.querySelector('[data-list-id="chat-messages"]');
        if (!scroller) return resolve({error: 'no scroller'});

        const extractCurrentDOM = () => {
            document.querySelectorAll('li[class*="messageListItem_"]').forEach(el => {
                const msgId = el.id || Math.random().toString(); 
                if (window.__crawledMessages.has(msgId)) return;
                
                const authorEl = el.querySelector('span[class*="username_"]');
                let author = authorEl ? authorEl.innerText : 'Unknown';
                // (Optional: handle Discord's grouped messages by looking at previous sibling authors)
                
                const contentEl = el.querySelector('div[id^="message-content-"]');
                let text = contentEl ? contentEl.innerText : '';
                
                if (text || contentEl) {
                    window.__crawledMessages.set(msgId, { id: msgId, text: `[${author}]: ${text}` });
                }
            });
        };

        const sleep = ms => new Promise(r => setTimeout(r, ms));
        
        let unchanged = 0;
        let lastTop = '';
        extractCurrentDOM();
        
        while (unchanged < 15) { // Try 15 times before admitting we are stuck
            scroller.scrollTop = 0;
            scroller.dispatchEvent(new WheelEvent('wheel', { deltaY: -1000, bubbles: true }));
            scroller.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', code: 'PageUp', keyCode: 33, bubbles: true }));
            
            await sleep(1500);
            extractCurrentDOM();
            
            let topId = scroller.querySelector('li[class*="messageListItem_"]')?.id || '';
            if (topId === lastTop) {
                unchanged++;
                scroller.scrollTop = 50; // Jiggle down to trick virtual scroller
                await sleep(500);
            } else {
                unchanged = 0;
                lastTop = topId;
            }
            
            // Check if we hit the very beginning of the channel
            if (document.querySelector('div[class*="emptyChannelIcon_"]')) break;
        }
        
        const sorted = Array.from(window.__crawledMessages.values()).sort((a, b) => {
            const idA = a.id.split('-').pop();
            const idB = b.id.split('-').pop();
            if (!idA || !idB) return 0;
            if (idA.length !== idB.length) return idA.length - idB.length;
            return idA.localeCompare(idB);
        });
        
        resolve({
            messages: sorted.map(m => m.text),
            reachedTop: !!document.querySelector('div[class*="emptyChannelIcon_"]'),
            oldestId: sorted.length > 0 ? sorted[0].id : null,
            total: window.__crawledMessages.size
        });
    });
}
```

## Step-by-Step Workflow

1. Navigate to the channel base URL using `browser_navigate`.
2. Run the `browser_evaluate` script above.
3. Save the JSON string output via a local Python script appending to a file.
4. If `reachedTop` is `false`, navigate to `https://discord.com/channels/{SERVER_ID}/{CHANNEL_ID}/{oldestId.split('-').pop()}`.
5. Loop step 2-4 until `reachedTop` is `true`.
