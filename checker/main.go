package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	_ "github.com/ncruces/go-sqlite3/driver"
	_ "github.com/ncruces/go-sqlite3/embed"
)

const (
	dbFile         = "metrics.db"
	scrapeInterval = 5 * time.Second
)

type cpuTicks struct {
	user, nice, system, idle, iowait, irq, softirq, steal uint64
}

func main() {
	log.Println("Запуск Go-агента мониторинга...")

	db, err := sql.Open("sqlite3", dbFile)
	if err != nil {
		log.Fatalf("Ошибка открытия базы данных: %v", err)
	}
	defer db.Close()

	createTableSQL := `CREATE TABLE IF NOT EXISTS system_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  cpu_usage REAL,
  ram_usage REAL
 );`
	if _, err := db.Exec(createTableSQL); err != nil {
		log.Fatalf("Ошибка создания таблицы: %v", err)
	}
	log.Println("База данных готова к работе.")

	prevTicks, err := getCPUTicks()
	if err != nil {
		log.Printf("Предупреждение: не удалось получить начальные тики CPU: %v", err)
	}

	ticker := time.NewTicker(scrapeInterval)
	defer ticker.Stop()

	for range ticker.C {
		ramUsage, err := getRAMUsage()
		if err != nil {
			log.Printf("Ошибка сбора метрик RAM: %v", err)
			continue
		}

		currentTicks, err := getCPUTicks()
		var cpuUsage float64
		if err == nil {
			cpuUsage = calculateCPUPercentage(prevTicks, currentTicks)
			prevTicks = currentTicks
		} else {
			log.Printf("Ошибка сбора метрик CPU: %v", err)
			continue
		}

		insertSQL := `INSERT INTO system_metrics (cpu_usage, ram_usage) VALUES (?, ?);`
		_, err = db.Exec(insertSQL, cpuUsage, ramUsage)
		if err != nil {
			log.Printf("Ошибка записи в БД: %v", err)
		} else {
			log.Printf("[DATA] CPU: %.2f%% | RAM: %.2f%% записано в %s", cpuUsage, ramUsage, dbFile)
		}
	}
}

func getRAMUsage() (float64, error) {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0, err
	}

	var memTotal, memAvailable float64
	lines := strings.Split(string(data), "\n")

	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		if fields[0] == "MemTotal:" {
			memTotal, _ = strconv.ParseFloat(fields[1], 64)
		}
		if fields[0] == "MemAvailable:" {
			memAvailable, _ = strconv.ParseFloat(fields[1], 64)
		}
	}

	if memTotal == 0 {
		return 0, fmt.Errorf("MemTotal равен 0, не удалось расчитать")
	}

	usedMem := memTotal - memAvailable
	return (usedMem / memTotal) * 100, nil
}

func getCPUTicks() (cpuTicks, error) {
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return cpuTicks{}, err
	}

	lines := strings.Split(string(data), "\n")
	if len(lines) == 0 {
		return cpuTicks{}, fmt.Errorf("пустой /proc/stat")
	}

	fields := strings.Fields(lines[0])
	if len(fields) < 5 {
		return cpuTicks{}, fmt.Errorf("неверный формат /proc/stat")
	}

	var t cpuTicks
	t.user, _ = strconv.ParseUint(fields[1], 10, 64)
	t.nice, _ = strconv.ParseUint(fields[2], 10, 64)
	t.system, _ = strconv.ParseUint(fields[3], 10, 64)
	t.idle, _ = strconv.ParseUint(fields[4], 10, 64)
	if len(fields) > 5 {
		t.iowait, _ = strconv.ParseUint(fields[5], 10, 64)
	}

	return t, nil
}
func calculateCPUPercentage(prev, curr cpuTicks) float64 {
	prevIdle := prev.idle + prev.iowait
	currIdle := curr.idle + curr.iowait

	prevNonIdle := prev.user + prev.nice + prev.system + prev.irq + prev.softirq + prev.steal
	currNonIdle := curr.user + curr.nice + curr.system + curr.irq + curr.softirq + curr.steal

	prevTotal := prevIdle + prevNonIdle
	currTotal := currIdle + currNonIdle

	totalDiff := float64(currTotal - prevTotal)
	idleDiff := float64(currIdle - prevIdle)

	if totalDiff == 0 {
		return 0.0
	}

	return ((totalDiff - idleDiff) / totalDiff) * 100
}
