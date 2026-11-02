package printing

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type JobType string

const (
	JobReceipt JobType = "RECEIPT"
	JobInvoice JobType = "INVOICE"
	JobBarcode JobType = "BARCODE"
	JobTest    JobType = "TEST"
)

type PrintJob struct {
	ID        string
	Type      JobType
	Data      []byte
	Retries   int
	CreatedAt time.Time
	Callback  func(job *PrintJob, err error)
}

type QueueStatus struct {
	Pending  int  `json:"pending"`
	Printing bool `json:"printing"`
}

type Queue struct {
	service *Service
	jobs    chan *PrintJob
	cancel  context.CancelFunc
	wg      sync.WaitGroup
	mu      sync.RWMutex
	pending int
	busy    bool
}

func NewQueue(service *Service) *Queue {
	return &Queue{
		service: service,
		jobs:    make(chan *PrintJob, 50),
	}
}

func (q *Queue) Start(ctx context.Context) {
	ctx, q.cancel = context.WithCancel(ctx)
	q.wg.Add(1)
	go q.worker(ctx)
}

func (q *Queue) Stop() {
	if q.cancel != nil {
		q.cancel()
	}
	q.wg.Wait()
}

func (q *Queue) Enqueue(job *PrintJob) {
	job.CreatedAt = time.Now()
	q.mu.Lock()
	q.pending++
	q.mu.Unlock()

	select {
	case q.jobs <- job:
	default:
		q.mu.Lock()
		q.pending--
		q.mu.Unlock()
		if job.Callback != nil {
			job.Callback(job, fmt.Errorf("print queue full"))
		}
	}
}

func (q *Queue) Status() QueueStatus {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return QueueStatus{
		Pending:  q.pending,
		Printing: q.busy,
	}
}

func (q *Queue) worker(ctx context.Context) {
	defer q.wg.Done()

	for {
		select {
		case <-ctx.Done():
			return
		case job := <-q.jobs:
			q.mu.Lock()
			q.busy = true
			q.mu.Unlock()

			err := q.executeJob(job)

			q.mu.Lock()
			q.pending--
			q.busy = false
			q.mu.Unlock()

			if job.Callback != nil {
				job.Callback(job, err)
			}
		}
	}
}

const maxRetries = 3

func (q *Queue) executeJob(job *PrintJob) error {
	cfg := q.service.GetConfig()
	var err error

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(1<<uint(attempt-1)) * 500 * time.Millisecond
			time.Sleep(backoff)
		}

		switch cfg.ConnectionType {
		case ConnWinRAW:
			err = SendToWindowsRAW(cfg.Name, job.Data)
		case ConnTCP:
			addr := fmt.Sprintf("%s:%d", cfg.Address, cfg.Port)
			if cfg.Port == 0 {
				addr = fmt.Sprintf("%s:9100", cfg.Address)
			}
			err = SendToTCP(addr, job.Data)
		case ConnUSB:
			err = SendToWindowsRAW(cfg.Name, job.Data)
		default:
			return fmt.Errorf("unsupported connection type: %s", cfg.ConnectionType)
		}

		if err == nil {
			return nil
		}
		job.Retries = attempt + 1
	}

	return fmt.Errorf("print failed after %d retries: %w", maxRetries, err)
}
