function pad(value: number, width = 2): string {
  return value.toString().padStart(width, "0");
}

export function toIsoTimestamp(date = new Date()): string {
  return date.toISOString();
}

export function toDatePath(date = new Date()): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}

export function createRunId(date = new Date()): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());
  const millisecond = pad(date.getMilliseconds(), 3);
  return `${year}${month}${day}-${hour}${minute}${second}-${millisecond}`;
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
