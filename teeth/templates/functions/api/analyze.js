export async function onRequestPost(context) {
    try {
        // 1. รับข้อมูลรูปภาพ Base64 จากหน้าเว็บ
        const requestData = await context.request.json();
        const imageBase64 = requestData.image.split(',')[1]; 

        // 2. ดึง API Key จาก Cloudflare (เราจะไปตั้งค่าในเว็บทีหลัง)
        const API_KEY = context.env.GEMINI_API_KEY;

        // 3. คำสั่ง Prompt แบบเดียวกับที่ใช้ใน Python
        const prompt = `
        คุณคือทันตแพทย์ผู้เชี่ยวชาญระดับโลก (Expert Dentist AI)
        จงวิเคราะห์ภาพช่องปากที่แนบมานี้อย่างละเอียด และตอบกลับมาเป็นรูปแบบ JSON เท่านั้น โดยมีโครงสร้างดังนี้:
        {
            "overall_status": "สรุปภาพรวมสุขภาพช่องปาก",
            "teeth_issues": [
                {"tooth_location": "ตำแหน่ง/ซี่ฟัน (เช่น ฟันกรามล่างขวา)", "issue": "ปัญหา (เช่น ฟันผุ)", "treatment": "วิธีรักษา (เช่น ควรอุด/ควรถอน)"}
            ],
            "gum_status": {"issue_detected": true, "details": "รายละเอียด", "treatment": "วิธีรักษา"},
            "tongue_status": {"issue_detected": false, "details": "รายละเอียด", "treatment": "คำแนะนำ"},
            "other_findings": ["ปัญหาอื่นๆ ที่พบ"],
            "recommendations": ["คำแนะนำในการดูแลรักษาเบื้องต้นแบบข้อๆ"]
        }
        `;

        // 4. ส่งข้อมูลไปให้ Google Gemini 1.5 Flash ผ่าน REST API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
                    ]
                }]
            })
        });

        const data = await response.json();
        
        // 5. นำคำตอบที่ได้มาจัดการให้เป็น JSON ที่สมบูรณ์
        let aiResponseText = data.candidates[0].content.parts[0].text;
        aiResponseText = aiResponseText.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
        const resultJson = JSON.parse(aiResponseText);

        // 6. ส่งผลลัพธ์กลับไปให้หน้าเว็บแสดงผล
        return new Response(JSON.stringify({ status: "success", data: resultJson }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ status: "error", message: error.toString() }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}