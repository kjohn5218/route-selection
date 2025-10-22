-- CreateTable
CREATE TABLE "period_routes" (
    "selectionPeriodId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("selectionPeriodId", "routeId"),
    CONSTRAINT "period_routes_selectionPeriodId_fkey" FOREIGN KEY ("selectionPeriodId") REFERENCES "selection_periods" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "period_routes_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "period_routes_selectionPeriodId_idx" ON "period_routes"("selectionPeriodId");
CREATE INDEX "period_routes_routeId_idx" ON "period_routes"("routeId");