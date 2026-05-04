const { Redis } = require('@upstash/redis');

const DEFAULT_DAILY_LIMIT = 15;
const memoryCounters = new Map();
let redisClient = null;

/**
 * 读取每日免费额度，避免环境变量填写异常时影响服务启动。
 *
 * @returns {number} 每日可用次数。
 */
function getDailyLimit() {
  const configuredLimit = Number(process.env.DAILY_FREE_LIMIT);

  if (Number.isInteger(configuredLimit) && configuredLimit > 0) {
    return configuredLimit;
  }

  return DEFAULT_DAILY_LIMIT;
}

/**
 * 生成当前 UTC 日期字符串，保证不同部署区域的日期分桶一致。
 *
 * @param {Date} [date] - 当前时间。
 * @returns {string} YYYY-MM-DD 日期字符串。
 */
function getUsageDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * 计算距离下一个 UTC 自然日的秒数，用于 Redis key 自动过期。
 *
 * @param {Date} [date] - 当前时间。
 * @returns {number} 过期秒数。
 */
function getSecondsUntilNextUtcDay(date = new Date()) {
  const nextDay = new Date(date);
  nextDay.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((nextDay.getTime() - date.getTime()) / 1000));
}

/**
 * 获取 Redis 客户端；未配置 Upstash 时返回 null，方便本地开发使用内存计数。
 *
 * @returns {Redis | null} Upstash Redis 客户端。
 */
function getRedisClient() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  if (!redisClient) {
    redisClient = Redis.fromEnv();
  }

  return redisClient;
}

/**
 * 使用本地内存记录额度，主要用于未配置 Redis 的本地开发验收。
 *
 * @param {string} key - 额度计数 key。
 * @param {number} ttlSeconds - 过期秒数。
 * @returns {number} 当前使用次数。
 */
function incrementMemoryUsage(key, ttlSeconds) {
  const now = Date.now();
  const existing = memoryCounters.get(key);

  if (!existing || existing.expiresAt <= now) {
    memoryCounters.set(key, {
      count: 1,
      expiresAt: now + ttlSeconds * 1000,
    });
    return 1;
  }

  existing.count += 1;
  return existing.count;
}

/**
 * 增加用户当日用量并返回计数结果。
 *
 * @param {string} userId - 匿名用户 ID。
 * @returns {Promise<{count: number, limit: number, remaining: number}>} 额度结果。
 */
async function incrementDailyUsage(userId) {
  const limit = getDailyLimit();
  const key = `aei:usage:${getUsageDate()}:${userId}`;
  const ttlSeconds = getSecondsUntilNextUtcDay();
  const redis = getRedisClient();
  let count;

  if (redis) {
    count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, ttlSeconds);
    }
  } else {
    count = incrementMemoryUsage(key, ttlSeconds);
  }

  return {
    count,
    limit,
    remaining: Math.max(limit - count, 0),
  };
}

/**
 * 校验并扣减每日免费额度，超过额度时直接返回 429。
 *
 * @param {import('express').Request} req - Express 请求对象。
 * @param {import('express').Response} res - Express 响应对象。
 * @param {import('express').NextFunction} next - Express next 回调。
 * @returns {Promise<void>}
 */
async function dailyUsageLimit(req, res, next) {
  try {
    const usage = await incrementDailyUsage(req.body.user_id);
    req.usage = usage;

    if (usage.count > usage.limit) {
      res.status(429).json({
        error: 'daily_limit_exceeded',
        limit: usage.limit,
        remaining: 0,
      });
      return;
    }

    next();
  } catch (error) {
    console.error('rate_limit_failed', error);
    res.status(503).json({
      error: 'rate_limit_unavailable',
      remaining: 0,
    });
  }
}

module.exports = {
  DEFAULT_DAILY_LIMIT,
  dailyUsageLimit,
  getDailyLimit,
  getSecondsUntilNextUtcDay,
  getUsageDate,
  incrementDailyUsage,
};
