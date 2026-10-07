const puppeteer = require("puppeteer-core");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const FFMPEG_PATH = "C:\\Users\\user\\AppData\\Local\\Programs\\Python\\Python313\\Lib\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe";
const OUTPUT_FILE = path.resolve(__dirname, "otp_square_merge_reel.mp4");

async function record() {
    console.log("Starting Reel Recording for otp.html...");
    console.log("Using FFmpeg at:", FFMPEG_PATH);
    console.log("Output video will be:", OUTPUT_FILE);

    const browser = await puppeteer.launch({
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            "--disable-gpu-vsync"
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });

        const fileUrl = "file:///" + path.resolve(__dirname, "otp.html").replace(/\\/g, "/");
        console.log("Loading page:", fileUrl);
        await page.goto(fileUrl, { waitUntil: "networkidle0" });

        // Let fonts and ambient shaders stabilize
        await new Promise(r => setTimeout(r, 1200));

        const client = await page.target().createCDPSession();
        const recordedFrames = [];

        client.on("Page.screencastFrame", async ({ data, sessionId, metadata }) => {
            recordedFrames.push({
                buffer: Buffer.from(data, "base64"),
                time: metadata.timestamp
            });
            try {
                await client.send("Page.screencastFrameAck", { sessionId });
            } catch (e) {
                // Ignore ack errors if already closed
            }
        });

        console.log("Starting CDP screencast at 1080x1920, 95% quality...");
        await client.send("Page.startScreencast", {
            format: "jpeg",
            quality: 95,
            maxWidth: 1080,
            maxHeight: 1920,
            everyNthFrame: 1
        });

        // 1. Initial State Showcase (2.0s)
        console.log("State 1: Showcasing Initial Frosted OTP + Rotating Gold Laser Border + Code Card...");
        await new Promise(r => setTimeout(r, 2000));

        // 2. Typing Digit 1
        console.log("State 2: Typing digit '1'...");
        await page.keyboard.type("1");
        await new Promise(r => setTimeout(r, 650));

        // 3. Typing Digit 2
        console.log("State 3: Typing digit '2'...");
        await page.keyboard.type("2");
        await new Promise(r => setTimeout(r, 650));

        // 4. Typing Digit 3
        console.log("State 4: Typing digit '3'...");
        await page.keyboard.type("3");
        await new Promise(r => setTimeout(r, 650));

        // 5. Typing Digit 4 -> Auto triggers Loading and Verification
        console.log("State 5: Typing digit '4' (triggers Quantum Radar Orbit Verification)...");
        await page.keyboard.type("4");

        // 6. Verification Loading + Success Checkmark Pop + Outro
        console.log("State 6: Recording Verification Loading Radar and Emerald Success Pop...");
        // 1.6s loading + 3.8s success celebration = 5.4s
        await new Promise(r => setTimeout(r, 5400));

        console.log("Stopping Screencast...");
        await client.send("Page.stopScreencast");
        console.log(`Total captured raw frames: ${recordedFrames.length}`);

        if (recordedFrames.length === 0) {
            throw new Error("No frames were captured!");
        }

        const t0 = recordedFrames[0].time;
        const totalDuration = recordedFrames[recordedFrames.length - 1].time - t0;
        console.log(`Real recording duration: ${totalDuration.toFixed(2)} seconds`);

        const FPS = 30;
        const totalOutputFrames = Math.max(1, Math.floor(totalDuration * FPS));
        console.log(`Resampling to ${totalOutputFrames} frames @ ${FPS} fps...`);

        // Find nearest frame for each timestamp
        let lastFoundIdx = 0;
        const framesToEncode = [];
        for (let i = 0; i < totalOutputFrames; i++) {
            const targetTime = t0 + (i / FPS);
            while (
                lastFoundIdx < recordedFrames.length - 1 &&
                Math.abs(recordedFrames[lastFoundIdx + 1].time - targetTime) <=
                Math.abs(recordedFrames[lastFoundIdx].time - targetTime)
            ) {
                lastFoundIdx++;
            }
            framesToEncode.push(recordedFrames[lastFoundIdx].buffer);
        }

        console.log(`Encoding video with FFmpeg to: ${OUTPUT_FILE}...`);
        await new Promise((resolve, reject) => {
            let stderrLog = "";
            const ffmpeg = spawn(FFMPEG_PATH, [
                "-y",
                "-f", "image2pipe",
                "-vcodec", "mjpeg",
                "-framerate", String(FPS),
                "-i", "-",
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                "-preset", "medium",
                "-crf", "18",
                "-movflags", "+faststart",
                OUTPUT_FILE
            ]);

            ffmpeg.stderr.on("data", (data) => {
                const s = data.toString();
                stderrLog += s;
                if (s.includes("frame=") || s.includes("Error") || s.includes("error")) {
                    process.stdout.write(s);
                }
            });

            ffmpeg.stdin.on("error", (err) => {
                // Ignore broken pipe or EOF when ffmpeg finishes
            });

            ffmpeg.on("close", (code) => {
                if (code === 0) {
                    console.log("\nFFmpeg encoding completed successfully!");
                    resolve();
                } else {
                    console.error("\nFFmpeg stderr:\n", stderrLog);
                    reject(new Error(`FFmpeg exited with error code ${code}`));
                }
            });

            ffmpeg.on("error", (err) => {
                reject(err);
            });

            // Write frames with drain handling for clean backpressure
            let idx = 0;
            function writeNext() {
                let ok = true;
                while (idx < framesToEncode.length && ok) {
                    const buf = framesToEncode[idx++];
                    ok = ffmpeg.stdin.write(buf);
                }
                if (idx < framesToEncode.length) {
                    ffmpeg.stdin.once("drain", writeNext);
                } else {
                    ffmpeg.stdin.end();
                }
            }
            writeNext();
        });

        const stat = fs.statSync(OUTPUT_FILE);
        console.log(`\n🎉 INSTAGRAM REEL READY!`);
        console.log(`File: ${OUTPUT_FILE}`);
        console.log(`Size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Resolution: 1080x1920 (9:16 Vertical Reel)`);
        console.log(`Duration: ${(totalOutputFrames / FPS).toFixed(1)}s @ ${FPS}fps`);

    } catch (err) {
        console.error("Recording error:", err);
    } finally {
        try {
            await browser.close();
        } catch (e) {
            // ignore cleanup lock on windows
        }
        process.exit(0);
    }
}

record();
