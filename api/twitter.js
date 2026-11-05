export default async function handler(req, res) {
    // Pengaturan CORS untuk akses frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { url } = req.query;

    // Validasi URL Twitter / X
    if (!url || (!url.includes('twitter.com') && !url.includes('x.com'))) {
        return res.status(400).json({ 
            success: false, 
            error: "Harap masukkan tautan Twitter / X yang valid (twitter.com atau x.com)." 
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

        // Eksekusi request media utama (kualitas 1080p) dan ekstraksi audio MP3 secara paralel
        const mediaRequest = fetch(
            `https://api.zapi.ink/v1/downloader:twitter/download?url=${encodedUrl}&quality=1080&audioOnly=false`,
            {
                method: 'GET',
                headers: { 'x-api-key': API_KEY }
            }
        );

        const audioRequest = fetch(
            `https://api.zapi.ink/v1/downloader:twitter/download?url=${encodedUrl}&audioOnly=true&audioFormat=mp3`,
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

            // Bersihkan ekstensi pada nama file agar menjadi judul bersih
            const cleanTitle = item.filename
                ? item.filename.replace(/\.(mp4|webm|mkv|mp3|jpg|jpeg|png)$/i, '').trim()
                : "Twitter / X Media";

            return res.status(200).json({
                success: true,
                type: isPhoto ? 'photo' : 'video',
                meta: {
                    title: cleanTitle,
                    author: item.author || "X Creator",
                    avatar: "https://abs.twimg.com/favicons/twitter.3.ico"
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
                error: "Konten Twitter / X tidak ditemukan, tweet bersifat privat, atau kuota ZAPI tercapai."
            });
        }

    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            error: "Koneksi ke server pemroses Twitter / X gagal atau terjadi timeout." 
        });
    }
}
