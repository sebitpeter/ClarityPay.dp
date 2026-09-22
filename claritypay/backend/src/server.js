const { app, prisma } = require("./app");

const PORT = Number(process.env.PORT || 4000);

if (require.main === module) {
  (async () => {
    try {
      await prisma.$connect();
      await require("./app").seed();
      app.listen(PORT, () => {
        console.log(`ClarityPay API running on http://localhost:${PORT}`);
      });
    } catch (error) {
      console.error("Unable to start ClarityPay API:", error);
      process.exit(1);
    }
  })();
}

module.exports = app;
