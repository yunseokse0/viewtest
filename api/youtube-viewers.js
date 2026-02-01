/**
 * Vercel Serverless API: YouTube 라이브 시청자 수 조회
 * 환경 변수: YOUTUBE_API_KEY (Vercel 프로젝트 설정에 추가)
 */
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const videoId = req.query.videoId;
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!videoId) {
        return res.status(400).json({ error: 'videoId 필요', viewerCount: null });
    }
    if (!apiKey) {
        return res.status(500).json({
            error: 'YOUTUBE_API_KEY가 Vercel 환경 변수에 설정되지 않았습니다.',
            viewerCount: null
        });
    }

    try {
        const url = 'https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=' +
            encodeURIComponent(videoId) + '&key=' + encodeURIComponent(apiKey);
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            return res.status(400).json({
                error: data.error.message || 'YouTube API 오류',
                viewerCount: null
            });
        }

        const item = data.items && data.items[0];
        if (!item || !item.liveStreamingDetails) {
            return res.status(200).json({
                error: '라이브 방송이 아니거나 시청자 수를 사용할 수 없습니다.',
                viewerCount: null
            });
        }

        const n = item.liveStreamingDetails.concurrentViewers;
        const parsed = n != null ? parseInt(n, 10) : NaN;
        const viewerCount = (parsed === parsed && parsed >= 0) ? parsed : null; // NaN/음수 방지
        return res.status(200).json({ viewerCount: viewerCount, error: null });
    } catch (err) {
        return res.status(500).json({
            error: err.message || '서버 오류',
            viewerCount: null
        });
    }
};
