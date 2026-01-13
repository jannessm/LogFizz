// @ts-ignore - d3-force types are optional
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, type SimulationNodeDatum, type SimulationLinkDatum } from 'd3-force';
import type { Timer, TimeLog } from '../types';

export interface TimerNode extends SimulationNodeDatum {
  id: string;
  timer: Timer;
  frequency: number;
  x?: number;
  y?: number;
}

export interface TimerEdge extends SimulationLinkDatum<TimerNode> {
  source: TimerNode | string;
  target: TimerNode | string;
  weight: number;
}

/**
 * Analyzes timelogs to build a transition graph between timers
 * Returns nodes (timers with frequency) and edges (transitions with weights)
 */
export function buildTimerGraph(timers: Timer[], timelogs: TimeLog[]): { nodes: TimerNode[], edges: TimerEdge[] } {
  const timer_ids = timers.map(t => t.id);

  // Sort timelogs by start_timestamp
  const sortedLogs = timelogs.filter(tl => timer_ids.includes(tl.timer_id))
                             .sort((a, b) =>
    new Date(a.start_timestamp).getTime() - new Date(b.start_timestamp).getTime()
  );

  // Count frequency for each timer (how many times it was used)
  const frequency: Record<string, number> = {};
  timers.forEach(t => frequency[t.id] = 0);
  
  sortedLogs.forEach(tl => {
    frequency[tl.timer_id] = (frequency[tl.timer_id] || 0) + 1;
  });

  // Build transition map: timer_id -> next_timer_id -> count
  const transitions: Record<string, Record<string, number>> = {};
  
  // Look for consecutive completed sessions
  for (let i = 0; i < sortedLogs.length - 1; i++) {
    const current = sortedLogs[i];
    const next = sortedLogs[i + 1];
    
    // Only count transition if current session ended and next is a different timer
    if (current.end_timestamp && current.timer_id !== next.timer_id) {
      const from = current.timer_id;
      const to = next.timer_id;
      
      if (!transitions[from]) transitions[from] = {};
      transitions[from][to] = (transitions[from][to] || 1) + 1;
    }
  }
  
  // Add missing transitions with weight 1
  for (const from of timer_ids) {
    if (!transitions[from]) transitions[from] = {};

    for (const to of timer_ids) {
      if (from !== to && !transitions[from][to]) {
        transitions[from][to] = 1;
      }
    }
  }

  // Create nodes
  const nodes: TimerNode[] = timers.map(timer => ({
    id: timer.id,
    timer,
    frequency: frequency[timer.id] || 0,
  }));

  // Create edges
  const edges: TimerEdge[] = [];
  Object.entries(transitions).forEach(([from, targets]) => {
    Object.entries(targets).forEach(([to, weight]) => {
      edges.push({
        source: from,
        target: to,
        weight,
      });
    });
  });

  return { nodes, edges };
}

/**
 * Computes 2D positions for timers using force-directed layout
 * More frequently used timers will be positioned towards the center
 * Timers with higher transition weights will be positioned closer together
 */
export function computeTimerLayout(
  timers: Timer[], 
  timelogs: TimeLog[],
  width: number = 500,
  height: number = 600,
  timerSize: number = 150
): Map<string, { x: number; y: number }> {
  if (timers.length === 0) {
    return new Map();
  }

  const { nodes, edges } = buildTimerGraph(timers, timelogs);

  // If no nodes, return empty
  if (nodes.length === 0) {
    return new Map();
  }

  // Single node - place in center
  if (nodes.length === 1) {
    return new Map([[nodes[0].id, { x: width / 2, y: height / 2 }]]);
  }

  // Calculate max frequency for normalization
  const maxFreq = Math.max(...nodes.map(n => n.frequency), 1);
  const maxWeight = edges.length > 0 ? Math.max(...edges.map(e => e.weight)) : 1;

  // Create force simulation
  const simulation = forceSimulation(nodes)
    // Center force pulls nodes towards the center
    .force('center', forceCenter(width / 2, height / 2))
    // Charge force - more frequently used timers have stronger attraction to center
    .force('charge', forceManyBody<TimerNode>()
      .strength((d: TimerNode) => {
        // More frequent timers = stronger pull to center (more negative = more attraction)
        const normalizedFreq = d.frequency / maxFreq;
        return -200 * (1 + normalizedFreq * 2);
      })
    )
    // Link force - higher weight = stronger attraction between connected timers
    .force('link', forceLink<TimerNode, TimerEdge>(edges)
      .id((d: TimerNode) => d.id)
      .distance((d: TimerEdge) => {
        // Higher weight = closer distance
        const normalizedWeight = d.weight / maxWeight;
        return 100 * (1 - normalizedWeight * 0.5); // 50-100 pixels
      })
      .strength((d: TimerEdge) => {
        // Higher weight = stronger connection
        const normalizedWeight = d.weight / maxWeight;
        return 0.5 + normalizedWeight * 0.5; // 0.5-1.0
      })
    )
    // Collision force - prevent overlap (timer size ~150px diameter)
    .force('collide', forceCollide<TimerNode>().radius(timerSize / 2 + 10));

  // Run simulation synchronously
  simulation.stop();
  for (let i = 0; i < 300; i++) {
    simulation.tick();
  }

  // Extract positions
  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach(node => {
    if (node.x !== undefined && node.y !== undefined) {
      // Clamp to bounds with padding
      const padding = 50;
      const x = Math.max(padding, Math.min(width - padding, node.x));
      const y = Math.max(padding, Math.min(height - padding, node.y));
      positions.set(node.id, { x, y });
    }
  });

  return positions;
}
