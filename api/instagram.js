export default async function handler(req, res) {
    // Pengaturan CORS untuk akses frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { url } = req.query;

    // Validasi URL khusus Instagram
    if (!url || !url.includes('instagram.com')) {
        return res.status(400).json({ 
            success: false, 
            error: "Harap masukkan URL Instagram yang valid (Reel/Post/Video/Foto)." 
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

        // Menjalankan request media utama (Video/Foto/Carousel) dan ekstraksi Audio MP3 secara paralel
        const mediaRequest = fetch(
            `https://api.zapi.ink/v1/downloader:instagram/download?url=${encodedUrl}&quality=1080&audioOnly=false`,
            {
                method: 'GET',
                headers: { 'x-api-key': API_KEY }
            }
        );

        const audioRequest = fetch(
            `https://api.zapi.ink/v1/downloader:instagram/download?url=${encodedUrl}&audioOnly=true&audioFormat=mp3`,
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

            // Deteksi konten foto atau carousel
            const isPhoto = item.type === 'image' || item.type === 'photo' || Array.isArray(item.urls) || Array.isArray(item.images);

            // Parsing list foto jika berbentuk carousel/album
            let photosList = [];
            if (isPhoto) {
                if (Array.isArray(item.urls)) {
                    photosList = item.urls;
                } else if (Array.isArray(item.images)) {
                    photosList = item.images.map(img => (typeof img === 'string' ? img : img.url));
                } else if (item.url) {
                    photosList = [item.url];
                }
            }

            // Normalisasi nama file menjadi judul bersih
            const cleanTitle = item.filename
                ? item.filename.replace(/\.(mp4|webm|mkv|mp3|jpg|jpeg|png)$/i, '').trim()
                : "Instagram Post";

            return res.status(200).json({
                success: true,
                type: isPhoto ? 'photo' : 'video',
                meta: {
                    title: cleanTitle,
                    author: item.author || "Instagram Creator",
                    avatar: "https://www.instagram.com/static/images/ico/favicon-192.png/625aca513718.png"
                },
                media: {
                    video_hd: isPhoto ? null : item.url,
                    photos: photosList,
                    audio: audData ? audData.url : null
                }
            });
        } else {
            return res.status(404).json({
                success: false,
                error: "Konten Instagram tidak ditemukan, akun bersifat privat, atau kuota ZAPI tercapai."
            });
        }

    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            error: "Koneksi ke server Instagram downloader gagal atau timeout." 
        });
    }
}
