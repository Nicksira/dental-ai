export async function onRequestPost(context) {
    try {
        // 1. รับข้อมูลรูปภาพ Base64 จากหน้าเว็บ
        const requestData = await context.request.json();
        
        // ดัก Error เผื่อไม่มีรูปส่งมา
        if (!requestData || !requestData.image) {
             return new Response(JSON.stringify({ status: "error", message: "ไม่พบข้อมูลรูปภาพ" }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const imageBase64 = requestData.image.split(',')[1]; 

        // 2. ดึง API Key
        const API_KEY = context.env.GEMINI_API_KEY;
        if (!API_KEY) {
            return new Response(JSON.stringify({ status: "error", message: "API Key is missing in Cloudflare settings" }), {
                status: 500, headers: { 'Content-Type': 'application/json' }
            });
        }

        // 3. คำสั่ง Prompt
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

        // 4. ยิง API
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
        
        // ดัก Error กรณี Google API มีปัญหา (เช่น คีย์ผิด หรือเน็ตเวิร์คพัง)
        if (!response.ok) {
            return new Response(JSON.stringify({ status: "error", message: `Google API Error: ${data.error?.message || 'Unknown Error'}` }), {
                status: response.status, headers: { 'Content-Type': 'application/json' }
            });
        }

        // ดัก Error กรณี AI ไม่ตอบกลับ หรือโดนบล็อกเนื้อหา
        if (!data.candidates || data.candidates.length === 0) {
             return new Response(JSON.stringify({ status: "error", message: "Gemini did not return any candidates. The image might be blocked by safety filters." }), {
                status: 500, headers: { 'Content-Type': 'application/json' }
            });
        }

        // 5. นำคำตอบที่ได้มาจัดการให้เป็น JSON
        let aiResponseText = data.candidates[0].content.parts[0].text;
        aiResponseText = aiResponseText.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
        const resultJson = JSON.parse(aiResponseText);

        // 6. ส่งมอบผลลัพธ์
        return new Response(JSON.stringify({ status: "success", data: resultJson }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        // จับ Error อื่นๆ ทั้งหมดที่ระบบคาดไม่ถึง
        return new Response(JSON.stringify({ status: "error", message: error.toString() }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
