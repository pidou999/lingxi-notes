declare module "turndown" {
  interface TurndownOptions {
    headingStyle?: "atx" | "setext";
    hr?: string;
    br?: string;
    bulletListMarker?: string;
    codeBlockStyle?: "indented" | "fenced";
    emDelimiter?: string;
    strongDelimiter?: string;
    linkStyle?: "inlined" | "referenced";
    linkReferenceStyle?: "full" | "collapsed" | "shortcut";
    preformattedCode?: boolean;
  }

  interface TurndownService {
    turndown(html: string): string;
    addRule(key: string, rule: any): this;
    keep(filter: any): this;
    remove(filter: any): this;
    use(plugin: any): this;
  }

  interface TurndownConstructor {
    new (options?: TurndownOptions): TurndownService;
    (options?: TurndownOptions): TurndownService;
  }

  const Turndown: TurndownConstructor;
  export default Turndown;
}
