import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import http from "http";
import net from "net";
import { setupGracefulShutdown } from "./server.js";

describe("Graceful shutdown handler", () => {
  let server: http.Server;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    server = http.createServer((_req, res) => {
      // Simulate a slow request
      setTimeout(() => {
        res.writeHead(200);
        res.end("ok");
      }, 100);
    });
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    processExitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    // Remove signal listeners added by setupGracefulShutdown
    process.removeAllListeners("SIGTERM");
    process.removeAllListeners("SIGINT");
    try {
      server.close();
    } catch {}
  });

  it("logs 'Graceful shutdown initiated' on first SIGTERM", (ctx) => {
    return new Promise<void>((resolve) => {
      server.listen(0, () => {
        setupGracefulShutdown(server);
        process.emit("SIGTERM");

        expect(consoleLogSpy).toHaveBeenCalledWith("Graceful shutdown initiated");
        resolve();
      });
    });
  });

  it("logs 'Graceful shutdown initiated' on first SIGINT", (ctx) => {
    return new Promise<void>((resolve) => {
      server.listen(0, () => {
        setupGracefulShutdown(server);
        process.emit("SIGINT");

        expect(consoleLogSpy).toHaveBeenCalledWith("Graceful shutdown initiated");
        resolve();
      });
    });
  });

  it("calls process.exit(1) on second signal during shutdown", () => {
    return new Promise<void>((resolve) => {
      server.listen(0, () => {
        setupGracefulShutdown(server);

        // First signal — initiates shutdown
        process.emit("SIGTERM");
        expect(processExitSpy).not.toHaveBeenCalledWith(1);

        // Second signal — force exit
        process.emit("SIGTERM");
        expect(processExitSpy).toHaveBeenCalledWith(1);
        resolve();
      });
    });
  });

  it("exits with code 0 when all connections close gracefully", () => {
    return new Promise<void>((resolve) => {
      server.listen(0, () => {
        setupGracefulShutdown(server);

        // No active connections, server.close() callback fires immediately
        process.emit("SIGTERM");

        // server.close() fires its callback asynchronously
        setTimeout(() => {
          expect(processExitSpy).toHaveBeenCalledWith(0);
          resolve();
        }, 50);
      });
    });
  });

  it("force-closes connections after 10s timeout", () => {
    vi.useFakeTimers();

    return new Promise<void>((resolve) => {
      server.listen(0, () => {
        const port = (server.address() as net.AddressInfo).port;
        setupGracefulShutdown(server);

        // Create a connection that stays open
        const socket = net.connect(port, () => {
          // Send a partial HTTP request to keep connection alive
          socket.write("GET / HTTP/1.1\r\nHost: localhost\r\n");

          // Initiate shutdown
          process.emit("SIGTERM");

          // Advance timer by 10s
          vi.advanceTimersByTime(10_000);

          expect(processExitSpy).toHaveBeenCalledWith(0);
          socket.destroy();
          vi.useRealTimers();
          resolve();
        });
      });
    });
  });

  it("stops accepting new connections after signal", () => {
    return new Promise<void>((resolve) => {
      server.listen(0, () => {
        const port = (server.address() as net.AddressInfo).port;
        setupGracefulShutdown(server);

        process.emit("SIGTERM");

        // Try to connect after shutdown initiated
        const socket = net.connect(port, () => {
          // This should fail or the connection be refused
          socket.destroy();
        });

        socket.on("error", (err: NodeJS.ErrnoException) => {
          expect(err.code).toBe("ECONNREFUSED");
          resolve();
        });

        // Give some time for the rejection
        setTimeout(() => {
          socket.destroy();
          resolve();
        }, 200);
      });
    });
  });
});
