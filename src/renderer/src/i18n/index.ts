import { ref, watch } from 'vue'
import en from './en'
import zh from './zh'

export type Locale = 'en' | 'zh'

/** 字典类型：以 en 为基准，key 完整性在编译期校验 */
export type Dict = Record<keyof typeof en, string>

// zh 字典按 en 的 key 集合做类型校验（缺失 / 拼写错误会直接编译报错）
const zhDict: Dict = zh

const STORAGE_KEY = 'batch-cut-locale'

function readInitialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'zh') return stored
  // 首次启动：跟随系统语言（Electron 渲染进程的 navigator.language 即 OS 区域设置）
  // 中文系统（zh-CN / zh-TW / zh-HK 等）默认中文，其余默认英文
  const sysLang = (navigator.language || '').toLowerCase()
  return sysLang.startsWith('zh') ? 'zh' : 'en'
}

/** 当前语言（响应式，组件中直接使用即自动更新） */
export const locale = ref<Locale>(readInitialLocale())

/** 切换语言并持久化 */
export function setLocale(l: Locale): void {
  locale.value = l
  localStorage.setItem(STORAGE_KEY, l)
}

/** 在中英文之间切换 */
export function toggleLocale(): void {
  setLocale(locale.value === 'en' ? 'zh' : 'en')
}

/** 简单插值：把 {name} 替换为 params.name */
function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (m, k: string) =>
    Object.prototype.hasOwnProperty.call(params, k) ? String(params[k]) : m
  )
}

/** 取当前语言文案；key 缺失时回退英文，再回退 key 本身 */
export function t(
  key: keyof Dict | (string & Record<never, never>),
  params?: Record<string, string | number>
): string {
  const dict: Record<string, string> = locale.value === 'zh' ? zhDict : en
  const val = dict[key] ?? (en as Record<string, string>)[key] ?? key
  return interpolate(val, params)
}

// 语言切换时同步 <html lang> 与窗口标题
watch(
  locale,
  (l) => {
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en'
    document.title = l === 'zh' ? zhDict['app.documentTitle'] : en['app.documentTitle']
  },
  { immediate: true }
)
