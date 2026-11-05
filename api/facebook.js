export default async function handler(req, res) {
    // Pengaturan CORS untuk akses frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { url } = req.query;

    // Validasi URL Facebook (mendukung facebook.com dan fb.watch)
    if (!url || (!url.includes('facebook.com') && !url.includes('fb.watch'))) {
        return res.status(400).json({ 
            success: false, 
            error: "Harap masukkan tautan Facebook yang valid (facebook.com atau fb.watch)." 
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

        // Eksekusi paralel: Video 1080p dan Audio MP3 terpisah
        const mediaRequest = fetch(
            `https://api.zapi.ink/v1/downloader:facebook/download?url=${encodedUrl}&quality=1080&audioOnly=false`,
            {
                method: 'GET',
                headers: { 'x-api-key': API_KEY }
            }
        );

        const audioRequest = fetch(
            `https://api.zapi.ink/v1/downloader:facebook/download?url=${encodedUrl}&audioOnly=true&audioFormat=mp3`,
            {
                method: 'GET',
                headers: { 'x-api-key': API_KEY }
            }
        ).catch(() => null);

        const [mediaRes, audioRes] = await Promise.all([mediaRequest, audioRequest]);

        const mediaJson = await mediaRes.json();
        const audioJson = audioRes && audioRes.ok ? await audioRes.json().catch(() => null) : null;

        // Validasi respon dari ZAPI
        if (mediaJson && mediaJson.data && mediaJson.data.ok) {
            const item = mediaJson.data;
            const audData = audioJson && audioJson.data && audioJson.data.ok ? audioJson.data : null;

            // Deteksi jenis konten (foto atau video)
            const isPhoto = item.type === 'image' || item.type === 'photo';

            // Bersihkan ekstensi dari filename untuk dijadikan judul
            const cleanTitle = item.filename
                ? item.filename.replace(/\.(mp4|webm|mkv|mp3|jpg|jpeg|png)$/i, '').trim()
                : "Facebook Video";

            return res.status(200).json({
                success: true,
                type: isPhoto ? 'photo' : 'video',
                meta: {
                    title: cleanTitle,
                    author: item.author || "Facebook Creator",
                    avatar: "https://www.facebook.com/favicon.ico"
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
                error: "Video Facebook tidak ditemukan, bersifat privat, atau kuota ZAPI tercapai."
            });
        }

    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            error: "Koneksi ke server pemroses Facebook gagal atau terjadi timeout." 
        });
    }
}
