// api/tiktok.js
import axios from 'axios';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { url } = req.query;

    if (!url || !url.includes('tiktok.com')) {
        return res.status(400).json({ success: false, error: "Link TikTok tidak valid!" });
    }

    // Pool API Publik Stabil (Real Endpoints)
    const apiPool = [
        `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
        `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`
    ];

    let lastError = null;

    // Algoritma Fallback Berfungsi Tanpa Dummy
    for (let i = 0; i < apiPool.length; i++) {
        try {
            console.log(`Mencoba API Node ${i + 1}...`);
            const response = await axios.get(apiPool[i], { timeout: 8000 }); // Timeout 8 detik
            const resData = response.data;

            // Standarisasi Output RifqyFlow (Parsing Data Asli)
            if (i === 0 && resData.code === 0) { // Format TikWM
                return res.status(200).json({
                    success: true,
                    provider: "Node Primary (Stable)",
                    meta: {
                        title: resData.data.title || "Video TikTok",
                        author: resData.data.author.nickname,
                        username: "@" + resData.data.author.unique_id,
                        avatar: resData.data.author.avatar,
                        cover: resData.data.cover,
                        stats: {
                            views: resData.data.play_count,
                            likes: resData.data.digg_count,
                            size_mb: (resData.data.size / 1024 / 1024).toFixed(2) + " MB"
                        }
                    },
                    urls: {
                        video_hd: resData.data.hdplay || resData.data.play,
                        video_watermark: resData.data.wmplay,
                        audio: resData.data.music,
                        is_images: resData.data.images ? true : false,
                        images: resData.data.images || []
                    }
                });
            } else if (i === 1 && resData.video) { // Format TiklyDown
                 return res.status(200).json({
                    success: true,
                    provider: "Node Backup (Failover)",
                    meta: {
                        title: resData.title || "Video TikTok",
                        author: resData.author.name,
                        username: "@" + resData.author.unique_id,
                        avatar: resData.author.avatar,
                        cover: resData.video.cover,
                        stats: {
                            views: "N/A", likes: "N/A", size_mb: "N/A"
                        }
                    },
                    urls: {
                        video_hd: resData.video.noWatermark,
                        audio: resData.music.play_url,
                        is_images: resData.images ? true : false,
                        images: resData.images?.map(img => img.url) || []
                    }
                });
            }
        } catch (error) {
            console.warn(`API Node ${i + 1} Error/Timeout.`);
            lastError = error.message;
        }
    }

    // Jika semua API gagal
    return res.status(500).json({ 
        success: false, 
        error: "Gagal mengambil data dari TikTok (Rate Limited/API Down). Coba lagi nanti.",
        debug: lastError
    });
}
