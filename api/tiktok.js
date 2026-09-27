export default async function handler(req, res) {
    // Pengaturan CORS untuk keamanan (TIDAK SAYA UBAH)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { url } = req.query;

    // Menambahkan akses douyin & xiaohongshu agar fitur HTML-mu sebelumnya berfungsi
    const supportedPlatforms = [
        'tiktok.com', 'douyin.com', 'xiaohongshu.com',
        'youtube.com', 'youtu.be', 'music.youtube.com',
        'spotify.com', 'open.spotify.com',
        'instagram.com', 'twitter.com', 'x.com',
        'facebook.com', 'fb.watch'
    ];

    if (!url || !supportedPlatforms.some(platform => url.includes(platform))) {
        return res.status(400).json({ 
            success: false, 
            error: "Harap masukkan link dari platform yang didukung (TikTok, YouTube, Spotify, Instagram, Twitter/X, Facebook, Douyin, Xiaohongshu)." 
        });
    }

    try {
        // ===================================================================
        // [FITUR DITAMBAHKAN] SERVER DIPERBANYAK (FALLBACK ROUTING ENGINE)
        // ===================================================================
        const encodedUrl = encodeURIComponent(url);
        
        // Deteksi platform dari URL
        const getPlatform = (link) => {
            if (link.includes('tiktok.com') || link.includes('douyin.com')) return 'tiktok';
            if (link.includes('xiaohongshu.com')) return 'xiaohongshu';
            if (link.includes('youtube.com') || link.includes('youtu.be')) return 'youtube';
            if (link.includes('spotify.com')) return 'spotify';
            if (link.includes('instagram.com')) return 'instagram';
            if (link.includes('twitter.com') || link.includes('x.com')) return 'twitter';
            if (link.includes('facebook.com') || link.includes('fb.watch')) return 'facebook';
            return 'unknown';
        };

        const platform = getPlatform(url);
        
        // Daftar Server API Aktif Terbaru (diperluas)
        const apiNodes = [
            // === TikTok / Douyin / Xiaohongshu ===
            { url: `https://www.tikwm.com/api/?url=${encodedUrl}&hd=1`, id: 'tikwm', platform: 'tiktok' },
            { url: `https://api.tiklydown.eu.org/api/download?url=${encodedUrl}`, id: 'tiklydown', platform: 'tiktok' },
            { url: `https://aemt.me/download/tiktok?url=${encodedUrl}`, id: 'aemt', platform: 'tiktok' },
            { url: `https://api.fgmods.is-a.dev/api/downloader/tiktok?url=${encodedUrl}`, id: 'fgmods', platform: 'tiktok' },
            
            // === YouTube / YouTube Music ===
            { url: `https://api.vevioz.com/api/button/mp3/${encodedUrl}`, id: 'vevioz-mp3', platform: 'youtube' },
            { url: `https://api.vevioz.com/api/button/mp4/${encodedUrl}`, id: 'vevioz-mp4', platform: 'youtube' },
            { url: `https://api.savetube.me/info?url=${encodedUrl}`, id: 'savetube', platform: 'youtube' },
            { url: `https://co.wuk.sh/api/json`, id: 'cobalt', platform: 'youtube', method: 'POST', body: { url: url } },
            
            // === Spotify ===
            { url: `https://api.spotidownloader.com/?url=${encodedUrl}`, id: 'spotidownloader', platform: 'spotify' },
            { url: `https://spotify-downloader-api.vercel.app/api?url=${encodedUrl}`, id: 'spotify-vercel', platform: 'spotify' },
            
            // === Instagram ===
            { url: `https://api.instagram.com/oembed?url=${encodedUrl}`, id: 'instagram-oembed', platform: 'instagram' },
            
            // === Twitter/X ===
            { url: `https://api.fxtwitter.com/status/${url.split('/status/')[1]?.split('?')[0] || ''}`, id: 'fxtwitter', platform: 'twitter' },
            
            // === Facebook ===
            { url: `https://api.facebook.com/video/download?url=${encodedUrl}`, id: 'facebook-basic', platform: 'facebook' }
        ];

        let data = { code: -1 }; // State default

        for (const node of apiNodes) {
            // Hanya coba API yang platformnya cocok
            if (node.platform && node.platform !== platform) continue;

            try {
                let response;
                if (node.method === 'POST') {
                    response = await fetch(node.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                        body: JSON.stringify(node.body || { url: url })
                    });
                } else {
                    response = await fetch(node.url, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                    });
                }
                const rawData = await response.json();

                // === TikTok: tikwm ===
                if (node.id === 'tikwm' && rawData.code === 0) {
                    data = rawData; 
                    break;
                } 
                // === TikTok: tiklydown ===
                else if (node.id === 'tiklydown' && rawData.video) {
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
                } 
                // === TikTok: aemt ===
                else if (node.id === 'aemt' && rawData.status) {
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
                } 
                // === TikTok: fgmods ===
                else if (node.id === 'fgmods' && rawData.status) {
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
                // === YouTube: savetube ===
                else if (node.id === 'savetube' && rawData.status === 'ok') {
                    data = {
                        code: 0,
                        data: {
                            title: rawData.title,
                            author: { nickname: rawData.author || "YouTube", avatar: rawData.thumbnail || "" },
                            hdplay: rawData.video_high || rawData.video,
                            play: rawData.video_low || rawData.video,
                            images: null,
                            music: rawData.audio
                        }
                    };
                    break;
                }
                // === YouTube: cobalt ===
                else if (node.id === 'cobalt' && rawData.status === 'stream' || rawData.status === 'redirect') {
                    data = {
                        code: 0,
                        data: {
                            title: rawData.title || "YouTube Video",
                            author: { nickname: rawData.author || "YouTube", avatar: rawData.thumbnail || "" },
                            hdplay: rawData.url,
                            play: rawData.url,
                            images: null,
                            music: rawData.audio || null
                        }
                    };
                    break;
                }
                // === Spotify: spotidownloader ===
                else if (node.id === 'spotidownloader' && rawData.download) {
                    data = {
                        code: 0,
                        data: {
                            title: rawData.title,
                            author: { nickname: rawData.artist, avatar: rawData.cover || "" },
                            hdplay: null,
                            play: null,
                            images: null,
                            music: rawData.download
                        }
                    };
                    break;
                }
                // === Twitter: fxtwitter ===
                else if (node.id === 'fxtwitter' && rawData.tweet) {
                    const media = rawData.tweet.media?.videos?.[0] || rawData.tweet.media?.photos?.[0];
                    data = {
                        code: 0,
                        data: {
                            title: rawData.tweet.text || "Twitter Media",
                            author: { nickname: rawData.tweet.author.name, avatar: rawData.tweet.author.avatar_url },
                            hdplay: media?.url || media?.variants?.[0]?.url || null,
                            play: media?.url || media?.variants?.[0]?.url || null,
                            images: rawData.tweet.media?.photos ? rawData.tweet.media.photos.map(p => p.url) : null,
                            music: null
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
