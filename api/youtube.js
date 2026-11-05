export default async function handler(req, res) {
    // Pengaturan CORS untuk keamanan
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { url } = req.query;

    // Validasi khusus YouTube
    if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
        return res.status(400).json({ success: false, error: "Harap masukkan link YouTube yang valid." });
    }

    try {
        // ===================================================================
        // KONFIGURASI API ZAPI MENGGUNAKAN VERCEL ENVIRONMENT VARIABLE
        // ===================================================================
        // Vercel akan otomatis mengambil nilai ZAPI_KEY dari dashboard Settings
        const API_KEY = process.env.ZAPI_KEY; 
        
        // Pengecekan keamanan jika kunci lupa diset di Vercel
        if (!API_KEY) {
            return res.status(500).json({ success: false, error: "Konfigurasi server bermasalah (API Key hilang)." });
        }

        const encodedUrl = encodeURIComponent(url);

        // Karena UI RifqyFlow butuh link Video & Audio muncul secara bersamaan,
        // kita jalankan 2 request paralel ke ZAPI (Video 1080p & MP3).
        const videoRequest = fetch(`https://api.zapi.ink/v1/downloader:youtube/download?url=${encodedUrl}&quality=1080&audioOnly=false`, {
            method: 'GET',
            headers: { 'x-api-key': API_KEY }
        });
        
        const audioRequest = fetch(`https://api.zapi.ink/v1/downloader:youtube/download?url=${encodedUrl}&audioOnly=true&audioFormat=mp3`, {
            method: 'GET',
            headers: { 'x-api-key': API_KEY }
        });

        // Eksekusi kedua request bersamaan agar proses (loading) tetap cepat
        const [videoRes, audioRes] = await Promise.all([videoRequest, audioRequest]);
        const videoJson = await videoRes.json();
        const audioJson = await audioRes.json();

        // ===================================================================
        // STANDARISASI DATA KE FORMAT RIFQYFLOW ULTRA
        // ===================================================================
        
        // Pastikan response video berhasil ("ok": true)
        if (videoJson.data && videoJson.data.ok) {
            const vidData = videoJson.data;
            const audData = (audioJson.data && audioJson.data.ok) ? audioJson.data : null;

            // ZAPI tidak mereturn 'title', tapi mereturn 'filename'. 
            // Kita bersihkan ekstensi (.mp4) agar menjadi judul yang rapi.
            const cleanTitle = vidData.filename 
                ? vidData.filename.replace(/\.(mp4|webm|mkv|mp3)$/i, '').trim() 
                : "YouTube Media";

            return res.status(200).json({
                success: true,
                type: 'video', // Memaksa UI untuk me-render player video
                meta: {
                    title: cleanTitle,
                    author: "YouTube Creator", // ZAPI tidak mereturn nama channel, kita pasang default
                    avatar: "https://www.youtube.com/img/desktop/yt_1200.png", // Logo YT Default
                },
                media: {
                    video_hd: vidData.url,
                    photos: [],
                    audio: audData ? audData.url : null
                }
            });
        } else {
            // Jika ZAPI menolak (misal: Rate limit 429 atau Video Private 404)
            return res.status(404).json({ 
                success: false, 
                error: "Gagal mengekstrak YouTube. Video mungkin diprivate atau kuota API habis." 
            });
        }

    } catch (error) {
        return res.status(500).json({ success: false, error: "Koneksi ke server ZAPI gagal (Timeout)." });
    }
}
