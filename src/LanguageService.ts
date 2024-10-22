export class LanguageService {
  private static messages: { [key: string]: string } = {};

  public static loadLanguage(lang: string): void {
    const messages = require(`./i18n/${lang}.json`);
    this.messages = messages;
  }

  public static getMessage(key: string): string {
    // 查找对应的消息，如果找不到，则返回默认的未知错误提示
    return this.messages[key] || key || this.messages["unknown.error"];
  }
}
