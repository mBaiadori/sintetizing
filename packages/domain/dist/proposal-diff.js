function tokenizeWords(text) {
    return text.match(/\S+|\s+/g) ?? [];
}
/**
 * Calcula Diff por palavras (LCS) entre dois textos, coalescendo segmentos contíguos do mesmo tipo.
 */
export function diffWords(left, right) {
    const leftTokens = tokenizeWords(left);
    const rightTokens = tokenizeWords(right);
    const m = leftTokens.length;
    const n = rightTokens.length;
    const cols = n + 1;
    const dp = new Int32Array((m + 1) * cols);
    for (let i = m - 1; i >= 0; i--) {
        for (let j = n - 1; j >= 0; j--) {
            if (leftTokens[i] === rightTokens[j]) {
                dp[i * cols + j] = dp[(i + 1) * cols + (j + 1)] + 1;
            }
            else {
                const down = dp[(i + 1) * cols + j];
                const rightScore = dp[i * cols + (j + 1)];
                dp[i * cols + j] = down >= rightScore ? down : rightScore;
            }
        }
    }
    const raw = [];
    let i = 0;
    let j = 0;
    while (i < m && j < n) {
        if (leftTokens[i] === rightTokens[j]) {
            raw.push({ kind: "equal", value: leftTokens[i] });
            i++;
            j++;
        }
        else if (dp[(i + 1) * cols + j] >= dp[i * cols + (j + 1)]) {
            raw.push({ kind: "removed", value: leftTokens[i] });
            i++;
        }
        else {
            raw.push({ kind: "added", value: rightTokens[j] });
            j++;
        }
    }
    while (i < m) {
        raw.push({ kind: "removed", value: leftTokens[i] });
        i++;
    }
    while (j < n) {
        raw.push({ kind: "added", value: rightTokens[j] });
        j++;
    }
    const coalesced = [];
    for (const segment of raw) {
        const previous = coalesced[coalesced.length - 1];
        if (previous && previous.kind === segment.kind) {
            coalesced[coalesced.length - 1] = {
                kind: previous.kind,
                value: previous.value + segment.value,
            };
        }
        else {
            coalesced.push(segment);
        }
    }
    return coalesced;
}
function buildCurrencyLookup(items) {
    const counts = new Map();
    const lookup = new Map();
    for (const item of items) {
        const normalized = item.label.trim().toLowerCase();
        const index = counts.get(normalized) ?? 0;
        counts.set(normalized, index + 1);
        lookup.set(`${normalized}#${index}`, item);
    }
    return lookup;
}
function diffCurrencies(leftItems, rightItems) {
    const leftMap = buildCurrencyLookup(leftItems);
    const rightMap = buildCurrencyLookup(rightItems);
    const seenKeys = new Set();
    const orderedKeys = [];
    for (const key of leftMap.keys()) {
        seenKeys.add(key);
        orderedKeys.push(key);
    }
    for (const key of rightMap.keys()) {
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            orderedKeys.push(key);
        }
    }
    const items = [];
    let leftTotalCents = 0;
    let rightTotalCents = 0;
    for (const key of orderedKeys) {
        const leftItem = leftMap.get(key);
        const rightItem = rightMap.get(key);
        if (leftItem && !rightItem) {
            leftTotalCents += leftItem.cents;
            items.push({
                label: leftItem.label,
                status: "removed",
                leftCents: leftItem.cents,
                rightCents: null,
                deltaCents: -leftItem.cents,
            });
        }
        else if (!leftItem && rightItem) {
            rightTotalCents += rightItem.cents;
            items.push({
                label: rightItem.label,
                status: "added",
                leftCents: null,
                rightCents: rightItem.cents,
                deltaCents: rightItem.cents,
            });
        }
        else {
            const l = leftItem;
            const r = rightItem;
            leftTotalCents += l.cents;
            rightTotalCents += r.cents;
            items.push({
                label: r.label,
                status: l.cents === r.cents ? "unchanged" : "changed",
                leftCents: l.cents,
                rightCents: r.cents,
                deltaCents: r.cents - l.cents,
            });
        }
    }
    return {
        items,
        leftTotalCents,
        rightTotalCents,
        totalDeltaCents: rightTotalCents - leftTotalCents,
    };
}
function diffArticles(leftArticles, rightArticles) {
    const articleNums = Array.from(new Set([...leftArticles.keys(), ...rightArticles.keys()])).sort((a, b) => a - b);
    return articleNums.map((articleNum) => {
        const leftText = leftArticles.get(articleNum) ?? null;
        const rightText = rightArticles.get(articleNum) ?? null;
        if (leftText !== null && rightText === null) {
            return {
                articleNum,
                status: "removed",
                leftText,
                rightText: null,
                segments: diffWords(leftText, ""),
            };
        }
        if (leftText === null && rightText !== null) {
            return {
                articleNum,
                status: "added",
                leftText: null,
                rightText,
                segments: diffWords("", rightText),
            };
        }
        const l = leftText;
        const r = rightText;
        return {
            articleNum,
            status: l === r ? "unchanged" : "changed",
            leftText: l,
            rightText: r,
            segments: diffWords(l, r),
        };
    });
}
/**
 * Comparador Universal N x N: compara quaisquer duas propostas da árvore campo a campo.
 */
export function diffProposals(left, right) {
    const titleChanged = left.title !== right.title;
    const titleSegments = diffWords(left.title, right.title);
    const bodyChanged = left.body !== right.body;
    const bodySegments = diffWords(left.body, right.body);
    const currencyComparison = diffCurrencies(left.currencies, right.currencies);
    const deadlineChanged = left.deadline !== right.deadline;
    const articles = diffArticles(left.articles, right.articles);
    const hasCurrencyChange = currencyComparison.items.some((c) => c.status !== "unchanged");
    const hasArticleChange = articles.some((a) => a.status !== "unchanged");
    return {
        leftDocIdHex: left.docIdHex,
        rightDocIdHex: right.docIdHex,
        titleChanged,
        titleSegments,
        bodyChanged,
        bodySegments,
        currencies: currencyComparison.items,
        leftTotalCents: currencyComparison.leftTotalCents,
        rightTotalCents: currencyComparison.rightTotalCents,
        totalDeltaCents: currencyComparison.totalDeltaCents,
        deadlineChanged,
        leftDeadline: left.deadline,
        rightDeadline: right.deadline,
        articles,
        hasAnyChange: titleChanged ||
            bodyChanged ||
            deadlineChanged ||
            hasCurrencyChange ||
            hasArticleChange,
    };
}
//# sourceMappingURL=proposal-diff.js.map