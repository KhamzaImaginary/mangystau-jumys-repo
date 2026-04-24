import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import { Telegraf } from "telegraf";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
try {
  if (admin.apps.length === 0) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccountKey) {
      try {
        let serviceAccount;
        if (serviceAccountKey.trim().startsWith('{')) {
          serviceAccount = JSON.parse(serviceAccountKey);
        } else if (serviceAccountKey.includes('-----BEGIN PRIVATE KEY-----')) {
          // If the user provided only the private key string
          serviceAccount = {
            projectId: firebaseConfig.projectId,
            privateKey: serviceAccountKey.replace(/\\n/g, '\n'),
            clientEmail: `firebase-adminsdk-1@${firebaseConfig.projectId}.iam.gserviceaccount.com`, // Heuristic
          };
          console.log("Constructing service account from private key string.");
        } else {
          throw new Error("Unknown format for FIREBASE_SERVICE_ACCOUNT_KEY");
        }

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: firebaseConfig.projectId
        });
        console.log("Firebase Admin initialized using Service Account.");
      } catch (parseErr: any) {
        console.error("Failed to process FIREBASE_SERVICE_ACCOUNT_KEY:", parseErr.message);
        admin.initializeApp({
          projectId: firebaseConfig.projectId
        });
      }
    } else {
      admin.initializeApp({
        projectId: firebaseConfig.projectId
      });
      console.log("Firebase Admin initialized with Project ID only (ADC).");
    }
  }
} catch (e) {
  console.error("Firebase Admin init error:", e);
}

// Ensure we handle both default and named databases correctly
let db: any;
try {
  const dbId = firebaseConfig.firestoreDatabaseId;
  // Use getFirestore from firebase-admin/firestore to target the specific database
  db = getFirestore(dbId || "(default)");
} catch (e) {
  console.error("Firestore init error:", e);
  db = getFirestore();
}

console.log(`Firebase Admin initialized for project: ${firebaseConfig.projectId}, database: ${firebaseConfig.firestoreDatabaseId || "(default)"}`);

// Initialize Telegram Bot
const botToken = process.env.TELEGRAM_BOT_TOKEN;
let bot: Telegraf | null = null;

if (botToken && botToken.includes(":")) {
  try {
    bot = new Telegraf(botToken);

    bot.start((ctx) => {
      ctx.reply(
        "Здравствуйте! Это бот Mangystau Jumys.\n\n" +
        "Для получения уведомлений используйте команду:\n" +
        "/link [ваш_ID]\n\n" +
        "ID можно найти на странице профиля."
      );
    });

    bot.command("link", async (ctx) => {
      const parts = ctx.message.text.split(" ");
      const userId = parts[1];
      
      if (!userId) {
        return ctx.reply("Ошибка: Укажите ID пользователя. Например: /link USER_ID");
      }

      try {
        console.log(`Attempting to link Telegram for user: ${userId} to Telegram ID: ${ctx.from.id}`);
        const userRef = db.collection("users").doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
          console.log(`User not found in Firestore: ${userId}`);
          return ctx.reply("Ошибка: Пользователь не найден.");
        }

        await userRef.update({
          telegramId: ctx.from.id.toString()
        });

        console.log(`Successfully linked user ${userId} to Telegram ID ${ctx.from.id}`);
        ctx.reply("Поздравляем! Ваш Telegram аккаунт успешно подключен. Теперь вы будете получать уведомления о новых откликах.");
      } catch (error: any) {
        console.error("Detailed Link Error:", {
          message: error.message,
          code: error.code,
          details: error.details,
          projectId: firebaseConfig.projectId,
          dbId: firebaseConfig.firestoreDatabaseId
        });
        
        let errorMsg = "Произошла ошибка при подключении.";
        if (error.code === 7 || error.message.includes("PERMISSION_DENIED")) {
          errorMsg = "Ошибка доступа (Permission Denied). Убедитесь, что Firebase настроен корректно для этого проекта.";
        }
        
        ctx.reply(`${errorMsg} Details: ${error.message}`);
      }
    });

    bot.launch()
      .then(() => console.log("Telegram bot launched successfully"))
      .catch(err => {
        console.error("Bot launch failed. Check if TELEGRAM_BOT_TOKEN is correct and valid:", err.message);
        bot = null; // Disable bot if launch failed
      });
  } catch (error) {
    console.error("Failed to initialize Telegraf:", error);
    bot = null;
  }
} else {
  console.warn("TELEGRAM_BOT_TOKEN is not set or invalid format. Bot functionality will be disabled.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Mangystau Jumys API is running", botActive: !!bot });
  });

  // Notify Employer API
  app.post("/api/notify-employer", async (req, res) => {
    const { employerId, jobTitle, seekerName, message } = req.body;

    if (!bot) {
      return res.status(503).json({ error: "Telegram bot is not active" });
    }

    try {
      const userRef = db.collection("users").doc(employerId);
      const userSnap = await userRef.get();

      if (userSnap.exists) {
        const userData = userSnap.data();
        if (userData && userData.telegramId) {
          const timestamp = new Date().toLocaleString('ru-RU');
          await bot.telegram.sendMessage(
            userData.telegramId,
            `🔔 Новый отклик!\n\n` +
            `💼 Вакансия: ${jobTitle}\n` +
            `👤 От: ${seekerName}\n` +
            `💬 Сообщение: ${message || 'Без сообщения'}\n` +
            `📅 Время: ${timestamp}\n\n` +
            `Кликните по ссылке в профиле, чтобы рассмотреть кандидата.`
          );
          return res.json({ success: true });
        }
      }
      res.json({ success: false, message: "User has no telegramId" });
    } catch (error: any) {
      console.error("Notify error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Notify Seeker API
  app.post("/api/notify-seeker", async (req, res) => {
    const { seekerId, jobTitle, status, reasoning } = req.body;

    if (!bot) {
      return res.status(503).json({ error: "Telegram bot is not active" });
    }

    try {
      const userRef = db.collection("users").doc(seekerId);
      const userSnap = await userRef.get();

      if (userSnap.exists) {
        const userData = userSnap.data();
        if (userData && userData.telegramId) {
          const statusMap: any = {
            'accepted': '✅ Принят',
            'rejected': '❌ Отклонен',
            'shortlisted': '📋 В списке отобранных',
            'viewed': '👀 Просмотрено'
          };
          
          const statusText = statusMap[status] || status;
          
          await bot.telegram.sendMessage(
            userData.telegramId,
            `🔔 Обновление статуса отклика!\n\n` +
            `💼 Вакансия: ${jobTitle}\n` +
            `📊 Новый статус: ${statusText}\n` +
            (reasoning ? `📝 Причина: ${reasoning}\n` : '') +
            `\nПроверьте подробности в своем кабинете.`
          );
          return res.json({ success: true });
        }
      }
      res.json({ success: false, message: "User has no telegramId" });
    } catch (error: any) {
      console.error("Notify seeker error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Check Job Alerts API
  app.post("/api/check-job-alerts", async (req, res) => {
    const { job } = req.body;
    if (!job || !bot) {
      return res.status(400).json({ error: "Missing job data or bot inactive" });
    }

    try {
      // Get all active job alerts
      const alertsRef = db.collection("job_alerts");
      const querySnapshot = await alertsRef.where("isActive", "==", true).get();

      const notificationsSent: string[] = [];

      for (const alertDoc of querySnapshot.docs) {
        const alert = alertDoc.data();
        
        // Match conditions
        const matchIndustry = !alert.industry || alert.industry === job.industry;
        const matchLocation = !alert.location || alert.location === job.location.microdistrict;
        
        let matchKeywords = true;
        if (alert.keywords) {
          const keywords = alert.keywords.toLowerCase().split(",").map((k: string) => k.trim());
          const jobText = (job.title + " " + job.description).toLowerCase();
          matchKeywords = keywords.some((k: string) => jobText.includes(k));
        }

        if (matchIndustry && matchLocation && matchKeywords) {
          // Find user to get telegramId
          const userRef = db.collection("users").doc(alert.userId);
          const userSnap = await userRef.get();
          
          if (userSnap.exists) {
            const userData = userSnap.data();
            if (userData && userData.telegramId) {
              // Generate a unique ID or use the job ID for the callback
              const jobId = job.id || "unknown"; // Assuming job has an ID from the source or we need to pass it
              
              await bot.telegram.sendMessage(
                userData.telegramId,
                `✨ *Найдена подходящая вакансия!*\n\n` +
                `💼 **${job.title}**\n` +
                `🏢 Сфера: ${job.industry}\n` +
                `📍 Район: ${job.location.microdistrict}\n` +
                (job.salary ? `💰 Зарплата: ${job.salary}\n` : '') +
                `\nЖелаете откликнуться?`,
                {
                  parse_mode: 'Markdown',
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: "✅ Откликнуться", callback_data: `apply_${jobId}` },
                        { text: "✕ Проигнорировать", callback_data: `ignore_${jobId}` }
                      ]
                    ]
                  }
                }
              );
              notificationsSent.push(alert.userId);
            }
          }
        }
      }

      res.json({ success: true, count: notificationsSent.length });
    } catch (error: any) {
      console.error("Check alerts error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Handle Callback Queries (Apply/Ignore)
  if (bot) {
    bot.on('callback_query', async (ctx: any) => {
      const data = ctx.callbackQuery.data;
      const telegramId = ctx.from.id.toString();

      if (data.startsWith('apply_')) {
        const jobId = data.replace('apply_', '');
        
        try {
          // 1. Find the seeker by telegramId
          const usersRef = db.collection("users");
          const userQuery = await usersRef.where("telegramId", "==", telegramId).get();
          
          if (userQuery.empty) {
            return ctx.answerCbQuery("Ошибка: Профиль не найден. Пожалуйста, привяжите аккаунт в приложении.");
          }

          const seekerDoc = userQuery.docs[0];
          const seekerData = seekerDoc.data();
          const seekerId = seekerDoc.id;

          // 2. Get Job Details to find the Employer
          const jobRef = db.collection("jobs").doc(jobId);
          const jobSnap = await jobRef.get();

          if (!jobSnap.exists) {
            return ctx.answerCbQuery("Ошибка: Вакансия больше не доступна.");
          }

          const jobData = jobSnap.data();

          // 3. Create Application
          const qualities = seekerData.skills ? `Мои навыки: ${seekerData.skills}. ` : "";
          const experience = seekerData.experience ? `Опыт: ${seekerData.experience}.` : "";
          const message = `Отклик через Telegram. ${qualities}${experience}`.trim();

          await db.collection("applications").add({
            jobId: jobId,
            employerId: jobData.employerId,
            seekerId: seekerId,
            message: message,
            status: 'pending',
            createdAt: new Date().toISOString()
          });

          await ctx.editMessageText(`✅ Вы успешно откликнулись на вакансию: *${jobData.title}*`, { parse_mode: 'Markdown' });
          ctx.answerCbQuery("Отклик успешно отправлен!");

          // 4. Optionally notify the employer (reuse logic or trigger API)
          // ... Notification to employer logic here ...

        } catch (error: any) {
          console.error("Apply callback error:", error);
          ctx.answerCbQuery("Произошла ошибка при отправке отклика.");
        }
      } else if (data.startsWith('ignore_')) {
        await ctx.editMessageText("👌 Вакансия проигнорирована.");
        ctx.answerCbQuery();
      }
    });
  }

  // Telegram Webhook (In case we want to switch to webhooks later)
  app.post("/api/telegram/webhook", (req, res) => {
    res.status(200).send("OK");
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
