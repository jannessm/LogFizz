import dayjs from 'dayjs';

export type Session = {
  startTime: string;
  endTime?: string | null;
  [key: string]: any;
};

class Node {
  session: Session;
  children: Node[];
  level: number;
  lastEndTime: dayjs.Dayjs;

  constructor(session: Session, now: dayjs.Dayjs) {
    this.session = session;
    this.children = [];
    this.level = 0;
    this.lastEndTime = session.endTime ? dayjs(session.endTime) : now;
  }

  addChild(child: Node, now: dayjs.Dayjs) {
    if (dayjs(this.session.startTime).isAfter(dayjs(child.session.startTime))) {
      // switch nodes if child starts earlier
      child.children.push(this);

      const childEndTime = child.session.endTime ? dayjs(child.session.endTime) : now;
      if (childEndTime.isAfter(this.lastEndTime)) {
        child.lastEndTime = childEndTime;
      } else if (childEndTime.isBefore(this.lastEndTime)) {
        child.lastEndTime = this.lastEndTime;
      }

      return child;
    }

    if (child.session.endTime) {
      const childEndTime = dayjs(child.session.endTime);
      if (childEndTime.isAfter(this.lastEndTime)) {
        this.lastEndTime = childEndTime;
      }
    } else {
      this.lastEndTime = now;
    }

    // check to which branch to add the child
    for (let c of this.children) {
      if (c.overlaps(child, now)) {
        const newChild = c.addChild(child, now);
        if (newChild) {
          // child was switched
          this.children = this.children.filter(ch => ch !== c);
          this.children.push(newChild);
        }
        return null;
      }
    }

    // no overlap with existing children, add here
    this.children.push(child);
    return null;
  }

  overlaps(other: Node, now: dayjs.Dayjs) {
    const aStart = dayjs(this.session.startTime);
    const aEnd = this.lastEndTime ? this.lastEndTime : now;

    const bStart = dayjs(other.session.startTime);
    const bEnd = other.session.endTime ? dayjs(other.session.endTime) : now;

    return aStart.isBefore(bEnd) && bStart.isBefore(aEnd);
  }

  assignLevels(level: number) {
    this.level = level;
    for (const child of this.children) {
      child.assignLevels(level + 1);
    }
  }
}


/**
 * Build indentation levels for overlapping sessions.
 * Returns a new array of sessions with an added `indentLevel` property.
 */
export function computeIndentation(sessionsList: Session[]) {
  const clones = sessionsList.map(s => ({ ...s }));
  const now = dayjs();

  // Build overlapping groups (transitive)
  const trees: Node[] = [];
  for (const s of clones) {
    let placed = false;
    const node = new Node(s, now);
    for (const root of trees) {
      if (root.overlaps(node, now)) {
        const newChild = root.addChild(node, now);
        placed = true;
        if (newChild) {
          // root was switched
          trees.splice(trees.indexOf(root), 1, newChild);
        }
        break;
      }
    }
    if (!placed) trees.push(node);
  }

  for (const tree of trees) {
    tree.assignLevels(0);
  }


  const output: Session[] = [];
  // Flatten trees into output array
  function traverse(node: Node) {
    const sessionWithLevel = { ...node.session, indentLevel: node.level };
    output.push(sessionWithLevel);
    for (const child of node.children) {
      traverse(child);
    }
  }

  for (const tree of trees) {
    traverse(tree);
  }

  return output.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}
