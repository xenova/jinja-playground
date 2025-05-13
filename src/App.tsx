import { useState, useEffect, useCallback } from "react";
import { Template } from "@huggingface/jinja";
import { Editor } from "@monaco-editor/react";
import {
  MoonIcon,
  SunIcon,
  RefreshCwIcon,
  CopyIcon,
  CheckIcon,
  CodeIcon,
} from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./components/ui/resizable";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { useTheme } from "./components/theme-provider";
import { Toaster } from "./components/ui/toaster";
import { toast } from "./components/ui/use-toast";

function App() {
  const { theme, setTheme } = useTheme();

  const [modelId, setModelId] = useState("");
  const [loading, setLoading] = useState(false);

  const [jinjaTemplate, setJinjaTemplate] = useState(
    "{% for message in messages %}{% if loop.first and messages[0]['role'] != 'system' %}{{ '<|im_start|>system\nYou are a helpful AI assistant named SmolLM, trained by Hugging Face<|im_end|>\n' }}{% endif %}{{'<|im_start|>' + message['role'] + '\n' + message['content'] + '<|im_end|>' + '\n'}}{% endfor %}{% if add_generation_prompt %}{{ '<|im_start|>assistant\n' }}{% endif %}",
  );

  const defaultInput = JSON.stringify(
    {
      messages: [
        { role: "user", content: "Hello, how are you?" },
        {
          role: "assistant",
          content: "I'm doing great. How can I help you today?",
        },
        { role: "user", content: "Can you tell me a joke?" },
      ],
      add_generation_prompt: true,
      bos_token: "<|im_start|>",
      eos_token: "<|im_end|>",
      pad_token: "<|im_end|>",
    },
    null,
    2,
  );

  const [jsonInput, setJsonInput] = useState(defaultInput);
  const [renderedOutput, setRenderedOutput] = useState("");
  const [renderError, setRenderError] = useState<string | null>(null);

  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  const renderTemplate = useCallback(() => {
    try {
      const inputData = JSON.parse(jsonInput);
      const template = new Template(jinjaTemplate);
      const result = template.render(inputData);
      setRenderedOutput(result);
      setRenderError(null);
    } catch (error) {
      console.error("Error rendering template:", error);
      setRenderError(error instanceof Error ? error.message : String(error));
    }
  }, [jinjaTemplate, jsonInput]);

  const fetchModelConfig = async () => {
    if (!modelId) {
      toast({
        title: "Error",
        description: "Please enter a model ID",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://huggingface.co/api/models/${modelId}?expand=config`,
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch model config: ${response.statusText}`);
      }

      const result = await response.json();
      const { chat_template, ...rest } =
        result.config.processor_config || result.config.tokenizer_config || {};

      if (chat_template) {
        setJinjaTemplate(chat_template);

        try {
          const currentInput = JSON.parse(jsonInput);
          const newInput: Record<string, string> = {};
          for (const [key, value] of Object.entries(rest)) {
            if (typeof value === "string") {
              newInput[key] = value;
            } else if (
              value &&
              typeof value === "object" &&
              (value as any).__type === "AddedToken" &&
              typeof (value as any).content === "string"
            ) {
              newInput[key] = (value as any).content;
            }
          }
          const updatedInput = {
            ...currentInput,
            ...newInput,
          };
          setJsonInput(JSON.stringify(updatedInput, null, 2));
        } catch (e) {
          console.error("Error updating JSON input:", e);
        }

        toast({
          title: "Template loaded",
          description: `Successfully loaded template from ${modelId}`,
        });
      } else {
        throw new Error("No chat template found in model config");
      }
    } catch (error) {
      console.error("Error fetching model config:", error);
      toast({
        title: "Error fetching model config",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTemplate = () => {
    try {
      const template = new Template(jinjaTemplate);
      const formatted = template.format();
      setJinjaTemplate(formatted);
      toast({
        title: "Template formatted",
        description: "Jinja template has been formatted successfully",
      });
    } catch (error) {
      console.error("Error formatting template:", error);
      toast({
        title: "Error formatting template",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (
    text: string,
    setCopied: (value: boolean) => void,
  ) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    renderTemplate();
  }, [jinjaTemplate, jsonInput, renderTemplate]);

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar */}
      <div className="w-64 border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">Jinja Playground</h1>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* Load Template Section */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Load from Hugging Face</h2>
            <div className="space-y-2">
              <Input
                placeholder="Model ID"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
              />
              <Button
                onClick={fetchModelConfig}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Load Template
              </Button>
            </div>
          </div>
        </div>

        {/* Theme Toggle at Bottom */}
        <div className="p-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full"
          >
            {theme === "dark" ? (
              <>
                <SunIcon className="h-4 w-4 mr-2" /> Light Mode
              </>
            ) : (
              <>
                <MoonIcon className="h-4 w-4 mr-2" /> Dark Mode
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <ResizablePanelGroup direction="vertical" className="flex-1">
          <ResizablePanel defaultSize={65} minSize={30}>
            <ResizablePanelGroup direction="horizontal">
              {/* Template Editor (Center) */}
              <ResizablePanel defaultSize={60} minSize={30}>
                <div className="h-full flex flex-col">
                  <div className="p-3 border-b flex justify-between items-center">
                    <h2 className="font-semibold">Jinja Template</h2>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={formatTemplate}
                        title="Format template"
                      >
                        <CodeIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(jinjaTemplate, setCopiedTemplate)
                        }
                        title="Copy template"
                      >
                        {copiedTemplate ? (
                          <CheckIcon className="h-4 w-4" />
                        ) : (
                          <CopyIcon className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    <Editor
                      height="100%"
                      defaultLanguage="jinja"
                      language="handlebars"
                      value={jinjaTemplate}
                      onChange={(value) => setJinjaTemplate(value || "")}
                      theme={theme === "dark" ? "vs-dark" : "light"}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        wordWrap: "on",
                      }}
                    />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle />

              {/* JSON Input (Right) */}
              <ResizablePanel defaultSize={40} minSize={20}>
                <div className="h-full flex flex-col">
                  <div className="p-3 border-b flex justify-between items-center">
                    <h2 className="font-semibold">JSON Input</h2>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(jsonInput, setCopiedJson)}
                      title="Copy JSON"
                    >
                      {copiedJson ? (
                        <CheckIcon className="h-4 w-4" />
                      ) : (
                        <CopyIcon className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <Editor
                      height="100%"
                      defaultLanguage="json"
                      value={jsonInput}
                      onChange={(value) => setJsonInput(value || "")}
                      theme={theme === "dark" ? "vs-dark" : "light"}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        formatOnPaste: true,
                        formatOnType: true,
                      }}
                    />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle />

          {/* Rendered Output (Bottom) */}
          <ResizablePanel defaultSize={35} minSize={15}>
            <div className="h-full flex flex-col">
              <div className="p-3 border-b flex justify-between items-center">
                <h2 className="font-semibold">Rendered Output</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(renderedOutput, setCopiedOutput)
                  }
                  title="Copy output"
                  disabled={!!renderError}
                >
                  {copiedOutput ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <CopyIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-4 font-mono text-sm whitespace-pre-wrap">
                {renderError ? (
                  <div className="text-red-500">{renderError}</div>
                ) : (
                  renderedOutput
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <Toaster />
    </div>
  );
}

export default App;
