/**
 * File này chỉ chịu trách nhiệm giao tiếp với API và trả về dữ liệu đã được xử lý.
 */

// Định nghĩa kiểu dữ liệu cho đối tượng coin trả về từ API của Binance
export interface BinanceCoin {
    symbol: string;
    priceChangePercent: string;
    lastPrice: string;
    quoteVolume: string;
    // Thêm các thuộc tính khác nếu cần
}

const BINANCE_API_URL = 'https://api.binance.com/api/v3/ticker/24hr';

/**
 * Tải và xử lý sơ bộ dữ liệu thị trường từ API của Binance.
 * @returns {Promise<BinanceCoin[] | null>} Một mảng các coin đã được lọc hoặc null nếu có lỗi.
 */
export const loadCryptoData = async (): Promise<BinanceCoin[] | null> => {
    try {
        const response = await fetch(BINANCE_API_URL);
        if (!response.ok) {
            console.error(`Lỗi API Binance: ${response.status}`);
            return null;
        }
        
        // API của Binance trả về một mảng các đối tượng
        const allCoins: BinanceCoin[] = await response.json();

        // Lọc các cặp giao dịch với USDT và có khối lượng giao dịch đáng kể
        const usdtPairs = allCoins.filter(coin => 
            coin.symbol.endsWith('USDT') && 
            parseFloat(coin.quoteVolume) > 100000
        );

        return usdtPairs;

    } catch (error) {
        console.error("Không thể tải dữ liệu crypto:", error);
        return null;
    }
};
