class CryptoAnalyzer {
    constructor() {
        this.baseUrl = 'https://api.binance.com/api/v3';
        this.updateInterval = 60000; // 1 minute
        this.init();
    }

    async init() {
        await this.updateData();
        setInterval(() => this.updateData(), this.updateInterval);
    }

    async updateData() {
        try {
            const [ticker24h, prices] = await Promise.all([
                this.fetch24hTicker(),
                this.fetchPrices()
            ]);
            
            const analyzedData = this.analyzeData(ticker24h, prices);
            this.updateUI(analyzedData);
        } catch (error) {
            console.error('數據更新失敗:', error);
        }
    }

    async fetch24hTicker() {
        const response = await fetch(`${this.baseUrl}/ticker/24hr`);
        return await response.json();
    }

    async fetchPrices() {
        const response = await fetch(`${this.baseUrl}/ticker/price`);
        return await response.json();
    }

    analyzeData(ticker24h, prices) {
        // 只選擇USDT交易對，並過濾掉成交量過低的幣種
        const validPairs = ticker24h.filter(ticker => {
            const volume = parseFloat(ticker.volume);
            const quoteVolume = parseFloat(ticker.quoteVolume);
            return ticker.symbol.endsWith('USDT') && 
                   volume > 0 && 
                   quoteVolume > 1000000; // 最小成交量限制
        });

        // 計算綜合分數
        const analyzedPairs = validPairs.map(ticker => {
            const priceChange = parseFloat(ticker.priceChangePercent);
            const volume = parseFloat(ticker.quoteVolume);
            const volatility = Math.abs(priceChange);
            
            // 計算推薦指數 (0-100)
            let score = 0;
            score += this.normalizeValue(volume, 0, 1000000000) * 30; // 成交量權重 30%
            score += this.normalizeValue(volatility, 0, 30) * 40; // 波動性權重 40%
            score += (priceChange > 0 ? 1 : 0) * 30; // 價格趨勢權重 30%

            const currentPrice = parseFloat(ticker.lastPrice);
            const high24h = parseFloat(ticker.highPrice);
            const low24h = parseFloat(ticker.lowPrice);
            
            // 計算目標價格和預期獲利
            const targetPrice = this.calculateTargetPrice(currentPrice, high24h, low24h, priceChange);
            const expectedProfit = ((targetPrice - currentPrice) / currentPrice * 100).toFixed(2);

            return {
                symbol: ticker.symbol,
                price: currentPrice,
                priceChange: priceChange,
                volume: volume,
                trend: this.analyzeTrend(ticker),
                targetPrice: targetPrice,
                expectedProfit: expectedProfit,
                score: Math.round(score)
            };
        });

        // 按推薦指數排序
        return analyzedPairs.sort((a, b) => b.score - a.score);
    }

    normalizeValue(value, min, max) {
        return Math.min(Math.max((value - min) / (max - min), 0), 1);
    }

    calculateTargetPrice(currentPrice, high24h, low24h, priceChange) {
        // 使用價格波動範圍和趨勢來計算目標價格
        const range = high24h - low24h;
        const volatility = range / low24h;
        
        if (priceChange > 0) {
            // 上漲趨勢：以當前價格為基準，根據波動率設定上漲目標
            const upTarget = currentPrice * (1 + volatility * 0.5);
            return Math.min(upTarget, high24h * 1.05); // 限制在24小時高點上方5%
        } else {
            // 下跌趨勢：尋找反彈機會，以當前價格和24小時低點之間的位置
            const bounceTarget = currentPrice * (1 + Math.abs(priceChange) * 0.3);
            return Math.min(bounceTarget, high24h); // 限制在24小時高點以下
        }
    }

    analyzeTrend(ticker) {
        const priceChange = parseFloat(ticker.priceChangePercent);
        if (priceChange > 5) return '強勢上漲';
        if (priceChange > 2) return '上漲';
        if (priceChange < -5) return '強勢下跌';
        if (priceChange < -2) return '下跌';
        return '橫盤整理';
    }

    formatVolume(volume) {
        if (volume >= 1000000000) {
            return `${(volume / 1000000000).toFixed(2)}B`;
        }
        if (volume >= 1000000) {
            return `${(volume / 1000000).toFixed(2)}M`;
        }
        if (volume >= 1000) {
            return `${(volume / 1000).toFixed(2)}K`;
        }
        return volume.toFixed(2);
    }

    updateUI(analyzedData) {
        // 更新市場概況
        document.getElementById('total-coins').textContent = analyzedData.length;
        
        const highestVolume = analyzedData.reduce((max, curr) => 
            curr.volume > max.volume ? curr : max, analyzedData[0]);
        document.getElementById('highest-volume').textContent = 
            `${highestVolume.symbol} (${this.formatVolume(highestVolume.volume)})`;

        const highestChange = analyzedData.reduce((max, curr) => 
            curr.priceChange > max.priceChange ? curr : max, analyzedData[0]);
        document.getElementById('highest-change').textContent = 
            `${highestChange.symbol} (${highestChange.priceChange.toFixed(2)}%)`;

        // 更新推薦列表
        const tableBody = document.getElementById('crypto-table');
        tableBody.innerHTML = analyzedData.slice(0, 20).map(coin => `
            <tr class="${coin.score >= 70 ? 'recommendation-high' : coin.score >= 50 ? 'recommendation-medium' : ''}">
                <td>${coin.symbol}</td>
                <td>${coin.price.toFixed(8)}</td>
                <td class="${coin.priceChange >= 0 ? 'trend-positive' : 'trend-negative'}">
                    ${coin.priceChange.toFixed(2)}%
                </td>
                <td>${this.formatVolume(coin.volume)}</td>
                <td>${coin.trend}</td>
                <td>${coin.targetPrice.toFixed(8)}</td>
                <td class="${coin.expectedProfit > 0 ? 'trend-positive' : 'trend-negative'}">
                    ${coin.expectedProfit}%
                </td>
                <td>${coin.score}/100</td>
            </tr>
        `).join('');
    }
}

// 啟動分析器
document.addEventListener('DOMContentLoaded', () => {
    new CryptoAnalyzer();
});
