export default async function handler(req, res) {
    // Pengaturan CORS untuk akses frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { url } = req.query;

    // Validasi URL Pinterest (mendukung link penuh dan shortlink pin.it)
    if (!url || (!url.includes('pinterest.com') && !url.includes('pin.it'))) {
        return res.status(400).json({ 
            success: false, 
            error: "Harap masukkan tautan Pinterest yang valid (pinterest.com atau pin.it)." 
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

        // Eksekusi request media utama (Video/Gambar) dan ekstrak audio jika tersedia secara non-blocking
        const mediaRequest = fetch(
            `https://api.zapi.ink/v1/downloader:pinterest/download?url=${encodedUrl}&quality=1080&audioOnly=false`,
            {
                method: 'GET',
                headers: { 'x-api-key': API_KEY }
            }
        );

        const audioRequest = fetch(
            `https://api.zapi.ink/v1/downloader:pinterest/download?url=${encodedUrl}&audioOnly=true&audioFormat=mp3`,
            {
                method: 'GET',
                headers: { 'x-api-key': API_KEY }
            }
        ).catch(() => null);

        const [mediaRes, audioRes] = await Promise.all([mediaRequest, audioRequest]);

        const mediaJson = await mediaRes.json();
        const audioJson = audioRes && audioRes.ok ? await audioRes.json().catch(() => null) : null;

        // Validasi response dari API ZAPI
        if (mediaJson && mediaJson.data && mediaJson.data.ok) {
            const item = mediaJson.data;
            const audData = audioJson && audioJson.data && audioJson.data.ok ? audioJson.data : null;

            // Deteksi jenis konten (gambar atau video)
            const isPhoto = item.type === 'image' || item.type === 'photo' || /\.(jpg|jpeg|png|webp)$/i.test(item.url);

            // Bersihkan format filename menjadi judul bersih
            const cleanTitle = item.filename
                ? item.filename.replace(/\.(mp4|webm|mkv|mp3|jpg|jpeg|png|webp)$/i, '').trim()
                : "Pinterest Pin";

            return res.status(200).json({
                success: true,
                type: isPhoto ? 'photo' : 'video',
                meta: {
                    title: cleanTitle,
                    author: "Pinterest Creator",
                    avatar: "https://assets.pinterest.com/favicon.png"
                },
                media: {
                    video_hd: isPhoto ? null : item.url,
                    photos: isPhoto ? [item.url] : [],
                    audio: (!isPhoto && audData) ? audData.url : null
                }
            });
        } else {
            return res.status(404).json({
                success: false,
                error: "Konten Pinterest tidak ditemukan, pin bersifat privat, atau kuota API tercapai."
            });
        }

    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            error: "Koneksi ke server pemroses Pinterest gagal atau terjadi timeout." 
        });
    }
}
