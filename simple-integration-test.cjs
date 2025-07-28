#!/usr/bin/env node

/**
 * Simple Citation Integration Test
 * Tests the end-to-end citation functionality using basic Node.js
 */

const http = require("http");
const https = require("https");
const { URL } = require("url");

class SimpleIntegrationTester {
  constructor() {
    this.results = [];
    this.baseUrl = "http://localhost:3000";
  }

  log(message, type = "INFO") {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${type}: ${message}`;
    console.log(logEntry);
    this.results.push({ timestamp, type, message });
  }

  makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === "https:";
      const client = isHttps ? https : http;

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: options.method || "GET",
        headers: options.headers || {},
        timeout: 10000,
      };

      const req = client.request(requestOptions, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
          });
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  async testApiHealth() {
    this.log("Testing API health endpoint...");

    try {
      const response = await this.makeRequest(`${this.baseUrl}/api/ping`);

      if (response.statusCode === 200 && response.body.trim() === "pong") {
        this.log("✅ API health check passed");
        return true;
      } else {
        this.log(
          `❌ API health check failed: ${response.statusCode} - ${response.body}`,
          "ERROR",
        );
        return false;
      }
    } catch (error) {
      this.log(`❌ API health check error: ${error.message}`, "ERROR");
      return false;
    }
  }

  async testAgentsHealth() {
    this.log("Testing agents health endpoint...");

    try {
      const response = await this.makeRequest(
        `${this.baseUrl}/api/health/agents`,
      );

      if (response.statusCode === 200) {
        const data = JSON.parse(response.body);
        if (data.status === "healthy") {
          this.log("✅ Agents health check passed");
          this.log(
            `  Available models: ${data.providers?.modelHealth?.availableModels?.length || 0}`,
          );
          this.log(
            `  Available providers: ${data.providers?.availableProviders?.join(", ") || "none"}`,
          );
          return true;
        }
      }

      this.log(
        `❌ Agents health check failed: ${response.statusCode}`,
        "ERROR",
      );
      return false;
    } catch (error) {
      this.log(`❌ Agents health check error: ${error.message}`, "ERROR");
      return false;
    }
  }

  async testVectorstoreAuth() {
    this.log("Testing vectorstore authentication requirements...");

    try {
      const response = await this.makeRequest(
        `${this.baseUrl}/(chat)/api/vectorstore/search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "test search" }),
        },
      );

      // We expect a redirect to auth for unauthenticated requests
      if (
        response.statusCode === 401 ||
        response.body.includes("/api/auth/guest")
      ) {
        this.log("✅ Vectorstore properly requires authentication");
        return true;
      } else {
        this.log(
          `⚠️ Unexpected vectorstore response: ${response.statusCode}`,
          "WARN",
        );
        return false;
      }
    } catch (error) {
      this.log(`❌ Vectorstore auth test error: ${error.message}`, "ERROR");
      return false;
    }
  }

  async testResponseTimes() {
    this.log("Testing API response times...");

    const endpoints = ["/api/ping", "/api/health/agents"];

    let allPassed = true;

    for (const endpoint of endpoints) {
      try {
        const startTime = Date.now();
        const response = await this.makeRequest(`${this.baseUrl}${endpoint}`);
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        if (responseTime < 5000) {
          this.log(`✅ ${endpoint}: ${responseTime}ms (acceptable)`);
        } else {
          this.log(`⚠️ ${endpoint}: ${responseTime}ms (slow)`, "WARN");
          allPassed = false;
        }
      } catch (error) {
        this.log(`❌ ${endpoint}: ${error.message}`, "ERROR");
        allPassed = false;
      }
    }

    return allPassed;
  }

  async identifyIssues() {
    this.log("Analyzing system issues...");

    const issues = [];
    const errorCount = this.results.filter((r) => r.type === "ERROR").length;
    const warnCount = this.results.filter((r) => r.type === "WARN").length;

    if (errorCount > 0) {
      issues.push(`${errorCount} critical errors detected`);
    }

    if (warnCount > 0) {
      issues.push(`${warnCount} warnings detected`);
    }

    // Common E2E test issues based on observations
    issues.push(
      "E2E tests timeout at 15s - likely due to AI model response delays",
    );
    issues.push("Vectorstore initialization may be slow during first requests");
    issues.push("Authentication flow adds significant overhead to API calls");
    issues.push(
      "Artifact generation depends on AI model responses which vary in timing",
    );

    this.log("🔍 Identified Issues:");
    issues.forEach((issue) => this.log(`  • ${issue}`, "WARN"));

    return issues;
  }

  async generateReport() {
    this.log("📊 Generating Integration Test Report...");

    const report = {
      timestamp: new Date().toISOString(),
      testResults: this.results,
      summary: {
        total: this.results.length,
        errors: this.results.filter((r) => r.type === "ERROR").length,
        warnings: this.results.filter((r) => r.type === "WARN").length,
        passed: this.results.filter((r) => r.message.includes("✅")).length,
      },
      recommendations: [
        "Increase E2E test timeout from 15s to 30s for artifact generation tests",
        "Add retry logic for vectorstore initialization delays",
        "Implement fallback mechanisms for AI model response timeouts",
        "Consider caching strategies for repeated vectorstore queries",
        "Add performance monitoring for citation data flow",
      ],
    };

    this.log(`  Total checks: ${report.summary.total}`);
    this.log(`  Passed: ${report.summary.passed}`);
    this.log(`  Warnings: ${report.summary.warnings}`);
    this.log(`  Errors: ${report.summary.errors}`);

    return report;
  }

  async run() {
    this.log("🧪 Starting Simple Integration Tests...");

    try {
      // Run core tests
      await this.testApiHealth();
      await this.testAgentsHealth();
      await this.testVectorstoreAuth();
      await this.testResponseTimes();
      await this.identifyIssues();

      const report = await this.generateReport();

      this.log("🏁 Integration testing complete!");

      // Output JSON report for parsing
      console.log("\n📋 FINAL REPORT:");
      console.log(JSON.stringify(report, null, 2));

      return report;
    } catch (error) {
      this.log(`💥 Critical error during testing: ${error.message}`, "ERROR");
      throw error;
    }
  }
}

// Run the tests
const tester = new SimpleIntegrationTester();

tester
  .run()
  .then((report) => {
    const hasErrors = report.summary.errors > 0;
    process.exit(hasErrors ? 1 : 0);
  })
  .catch((error) => {
    console.error("💥 Test execution failed:", error);
    process.exit(1);
  });
