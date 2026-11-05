export default async function handler(req, res) {
    // Pengaturan CORS untuk akses frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { url } = req.query;

    // Validasi URL Threads (mendukung threads.net dan threads.com)
    if (!url || (!url.includes('threads.net') && !url.includes('threads.com'))) {
        return res.status(400).json({ 
            success: false, 
            error: "Harap masukkan tautan Threads yang valid (threads.net atau threads.com)." 
        });
    }

    try {
        // Mengambil API Key dari Environment Variable Vercel
        const API_KEY = process.env.ZAPI_KEY;

        if (!API_KEY) {
            return res.status(500).json({ 
                success: false, 
                error: "Konfigurasi server bermasalah (ZAPI_KEY belum disetel di Vercel)." 
            });
        }

        const encodedUrl = encodeURIComponent(url);

        // Eksekusi pemanggilan ke endpoint ZAPI Threads
        const response = await fetch(
            `https://api.zapi.ink/v1/downloader:threads/download?url=${encodedUrl}`,
            {
                method: 'GET',
                headers: { 'x-api-key': API_KEY }
            }
        );

        const resJson = await response.json();

        // Validasi struktur data respon ZAPI
        if (resJson && resJson.data) {
            const data = resJson.data;
            const mediaList = Array.isArray(data.media) ? data.media : [];

            // Identifikasi tautan video jika tersedia
            const videoItem = mediaList.find(m => m.type === 'video' && m.video);
            const videoUrl = videoItem ? videoItem.video : (data.video || null);

            // Kumpulkan seluruh URL foto/gambar untuk galeri carousel
            let photosList = mediaList
                .map(m => m.image || (m.type === 'image' ? m.url : null))
                .filter(Boolean);

            if (photosList.length === 0 && data.image) {
                photosList = [data.image];
            }

            // Tentukan tipe media utama untuk antarmuka RifqyFlow
            const isPhoto = Boolean(data.isCarousel || data.type === 'carousel' || data.type === 'image' || (photosList.length > 0 && !videoUrl));

            // Format nama author dan caption
            const authorName = data.author?.fullName 
                ? `${data.author.fullName} (@${data.author.username})` 
                : (data.author?.username ? `@${data.author.username}` : "Threads Creator");

            const cleanTitle = data.caption ? data.caption.trim() : "Threads Post";

            return res.status(200).json({
                success: true,
                type: isPhoto ? 'photo' : 'video',
                meta: {
                    title: cleanTitle,
                    author: authorName,
                    avatar: data.author?.avatar || "https://www.threads.net/favicon.ico"
                },
                media: {
                    video_hd: videoUrl,
                    photos: photosList,
                    audio: null
                }
            });
        } else {
            return res.status(404).json({
                success: false,
                error: "Konten Threads tidak ditemukan, akun privat, atau kuota ZAPI tercapai."
            });
        }

    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            error: "Koneksi ke server Threads downloader gagal atau terjadi timeout." 
        });
    }
}
