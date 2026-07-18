export default async function handler(req, res) {
    // Pengaturan CORS untuk keamanan (TIDAK SAYA UBAH)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { url } = req.query;

    // Menambahkan akses douyin & xiaohongshu agar fitur HTML-mu sebelumnya berfungsi
    if (!url || (!url.includes('tiktok.com') && !url.includes('douyin.com') && !url.includes('xiaohongshu.com'))) {
        return res.status(400).json({ success: false, error: "Harap masukkan link TikTok yang valid." });
    }

    try {
        // ===================================================================
        // [FITUR DITAMBAHKAN] SERVER DIPERBANYAK (FALLBACK ROUTING ENGINE)
        // ===================================================================
        const encodedUrl = encodeURIComponent(url);
        
        // Daftar 4 Server API Aktif Terbaru
        const apiNodes = [
            { url: `https://www.tikwm.com/api/?url=${encodedUrl}&hd=1`, id: 'tikwm' },
            { url: `https://api.tiklydown.eu.org/api/download?url=${encodedUrl}`, id: 'tiklydown' },
            { url: `https://aemt.me/download/tiktok?url=${encodedUrl}`, id: 'aemt' },
            { url: `https://api.fgmods.is-a.dev/api/downloader/tiktok?url=${encodedUrl}`, id: 'fgmods' }
        ];

        let data = { code: -1 }; // State default

        for (const node of apiNodes) {
            try {
                // Mengambil data dari API
                const response = await fetch(node.url);
                const rawData = await response.json();

                // Standarisasi response ke format awal agar kode aslimu TIDAK ERROR
                if (node.id === 'tikwm' && rawData.code === 0) {
                    data = rawData; 
                    break;
                } else if (node.id === 'tiklydown' && rawData.video) {
                    data = {
                        code: 0,
                        data: {
                            title: rawData.title,
                            author: { nickname: rawData.author.name, avatar: rawData.author.avatar },
                            hdplay: rawData.video.noWatermark,
                            play: rawData.video.noWatermark,
                            images: rawData.images ? rawData.images.map(img => img.url) : null,
                            music: rawData.music.play_url
                        }
                    }; 
                    break;
                } else if (node.id === 'aemt' && rawData.status) {
                    data = {
                        code: 0,
                        data: {
                            title: rawData.result.title,
                            author: { nickname: rawData.result.author, avatar: "https://ui-avatars.com/api/?name=" + rawData.result.author },
                            hdplay: rawData.result.video_nowm,
                            play: rawData.result.video_nowm,
                            images: null,
                            music: rawData.result.audio
                        }
                    };
                    break;
                } else if (node.id === 'fgmods' && rawData.status) {
                    data = {
                        code: 0,
                        data: {
                            title: rawData.result.title || "Video Media",
                            author: { nickname: rawData.result.author_name || "User", avatar: rawData.result.author_avatar || "" },
                            hdplay: rawData.result.play,
                            play: rawData.result.play,
                            images: rawData.result.images || null,
                            music: rawData.result.music
                        }
                    };
                    break;
                }
            } catch (e) {
                // Jika server mati/limit, abaikan dan otomatis melompat ke server selanjutnya
                continue; 
            }
        }
        // ===================================================================
        // BATAS FITUR TAMBAHAN - KODE DI BAWAH ADALAH MILIKMU (TIDAK DIUBAH)
        // ===================================================================

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
