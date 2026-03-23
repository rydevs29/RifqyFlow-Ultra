export default async function handler(req, res) {
    // Pengaturan CORS untuk keamanan
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { url } = req.query;

    if (!url || !url.includes('tiktok.com')) {
        return res.status(400).json({ success: false, error: "Harap masukkan link TikTok yang valid." });
    }

    try {
        // Mengambil data dari API dengan parameter HD
        const response = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`);
        const data = await response.json();

        if (data.code === 0) {
            const result = data.data;
            // Deteksi otomatis apakah ini postingan foto atau video
            const isPhoto = !!result.images;

            return res.status(200).json({
                success: true,
                type: isPhoto ? 'photo' : 'video',
                meta: {
                    title: result.title,
                    author: result.author.nickname,
                    avatar: result.author.avatar,
                },
                media: {
                    video_hd: isPhoto ? null : (result.hdplay || result.play),
                    photos: isPhoto ? result.images : [],
                    audio: result.music
                }
            });
        } else {
            return res.status(404).json({ success: false, error: "Konten tidak ditemukan atau di-private." });
        }
    } catch (error) {
        return res.status(500).json({ success: false, error: "Koneksi server gagal. Coba lagi nanti." });
    }
}
