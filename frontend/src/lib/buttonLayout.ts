import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, type SimulationNodeDatum, type SimulationLinkDatum } from 'd3-force';
import type { Button, TimeLog } from '../types';

export interface ButtonNode extends SimulationNodeDatum {
  id: string;
  button: Button;
  frequency: number;
  x?: number;
  y?: number;
}

export interface ButtonEdge extends SimulationLinkDatum<ButtonNode> {
  source: ButtonNode | string;
  target: ButtonNode | string;
  weight: number;
}

/**
 * Analyzes timelogs to build a transition graph between buttons
 * Returns nodes (buttons with frequency) and edges (transitions with weights)
 */
export function buildButtonGraph(buttons: Button[], timelogs: TimeLog[]): { nodes: ButtonNode[], edges: ButtonEdge[] } {
  const button_ids = buttons.map(b => b.id);

  // Sort timelogs by start_timestamp
  const sortedLogs = timelogs.filter(tl => button_ids.includes(tl.button_id))
                             .sort((a, b) =>
    new Date(a.start_timestamp).getTime() - new Date(b.start_timestamp).getTime()
  );

  // Count frequency for each button (how many times it was used)
  const frequency: Record<string, number> = {};
  buttons.forEach(b => frequency[b.id] = 0);
  
  sortedLogs.forEach(tl => {
    frequency[tl.button_id] = (frequency[tl.button_id] || 0) + 1;
  });

  // Build transition map: button_id -> next_button_id -> count
  const transitions: Record<string, Record<string, number>> = {};
  
  // Look for consecutive completed sessions
  for (let i = 0; i < sortedLogs.length - 1; i++) {
    const current = sortedLogs[i];
    const next = sortedLogs[i + 1];
    
    // Only count transition if current session ended and next is a different button
    if (current.end_timestamp && current.button_id !== next.button_id) {
      const from = current.button_id;
      const to = next.button_id;
      
      if (!transitions[from]) transitions[from] = {};
      transitions[from][to] = (transitions[from][to] || 1) + 1;
    }
  }
  
  // Add missing transitions with weight 1

  for (const from of button_ids) {
    if (!transitions[from]) transitions[from] = {};

    for (const to of button_ids) {
      if (from !== to && !transitions[from][to]) {
        transitions[from][to] = 1;
      }
    }
  }

  // Create nodes
  const nodes: ButtonNode[] = buttons.map(button => ({
    id: button.id,
    button,
    frequency: frequency[button.id] || 0,
  }));

  // Create edges
  const edges: ButtonEdge[] = [];
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
 * Computes 2D positions for buttons using force-directed layout
 * More frequently used buttons will be positioned towards the center
 * Buttons with higher transition weights will be positioned closer together
 */
export function computeButtonLayout(
  buttons: Button[], 
  timelogs: TimeLog[],
  width: number = 500,
  height: number = 600,
  buttonSize: number = 150
): Map<string, { x: number; y: number }> {
  if (buttons.length === 0) {
    return new Map();
  }

  const { nodes, edges } = buildButtonGraph(buttons, timelogs);

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
    // Charge force - more frequently used buttons have stronger attraction to center
    .force('charge', forceManyBody<ButtonNode>()
      .strength(d => {
        // More frequent buttons = stronger pull to center (more negative = more attraction)
        const normalizedFreq = d.frequency / maxFreq;
        return -200 * (1 + normalizedFreq * 2);
      })
    )
    // Link force - higher weight = stronger attraction between connected buttons
    .force('link', forceLink<ButtonNode, ButtonEdge>(edges)
      .id(d => d.id)
      .distance(d => {
        // Higher weight = closer distance
        const normalizedWeight = d.weight / maxWeight;
        return 100 * (1 - normalizedWeight * 0.5); // 50-100 pixels
      })
      .strength(d => {
        // Higher weight = stronger connection
        const normalizedWeight = d.weight / maxWeight;
        return 0.5 + normalizedWeight * 0.5; // 0.5-1.0
      })
    )
    // Collision force - prevent overlap (button size ~150px diameter)
    .force('collide', forceCollide<ButtonNode>().radius(buttonSize / 2 + 10));

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

/**
 * Validates and fixes overlapping timelogs during sync
 * Ensures timelogs with no end_timestamp get proper end_timestamp
 * when a new session starts for the same button
 */
export function validateAndFixTimelogs(timelogs: TimeLog[]): TimeLog[] {
  // Sort by start_timestamp
  const sorted = [...timelogs].sort((a, b) => 
    new Date(a.start_timestamp).getTime() - new Date(b.start_timestamp).getTime()
  );

  const fixed: TimeLog[] = [];
  const activeSession = new Map<string, TimeLog>(); // button_id -> active session without end

  for (const log of sorted) {
    const buttonId = log.button_id;

    // Check if this button already has an active session without end
    if (activeSession.has(buttonId) && !log.end_timestamp) {
      // Need to close the previous session 1 second before this one starts
      const previousSession = activeSession.get(buttonId)!;
      const startTime = new Date(log.start_timestamp).getTime();
      const endTime = new Date(startTime - 1000); // 1 second before
      const durationMinutes = Math.round((endTime.getTime() - new Date(previousSession.start_timestamp).getTime()) / (1000 * 60));

      // Update the previous session with end_timestamp and duration
      const updatedPrevious: TimeLog = {
        ...previousSession,
        end_timestamp: endTime.toISOString(),
        duration_minutes: durationMinutes,
        updated_at: new Date().toISOString(),
      };

      // Replace the previous session in fixed array
      const prevIndex = fixed.findIndex(f => f.id === previousSession.id);
      if (prevIndex >= 0) {
        fixed[prevIndex] = updatedPrevious;
      }
      
      activeSession.delete(buttonId);
    }

    // Add this session
    fixed.push(log);
    
    // Track if this is an active session (no end_timestamp)
    if (!log.end_timestamp) {
      activeSession.set(buttonId, log);
    }
  }

  return fixed;
}
