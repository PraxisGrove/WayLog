import { type Href, Link } from "expo-router";
import {
  openBrowserAsync,
  WebBrowserPresentationStyle,
} from "expo-web-browser";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  onOpenError?: (error: unknown) => void;
};

export function ExternalLink({ href, onOpenError, onPress, ...rest }: Props) {
  return (
    <Link
      target="_blank"
      {...rest}
      href={href as Href}
      onPress={async (event) => {
        onPress?.(event);

        if (process.env.EXPO_OS !== "web") {
          event.preventDefault();

          try {
            await openBrowserAsync(href, {
              presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
            });
          } catch (error) {
            onOpenError?.(error);
          }
        }
      }}
    />
  );
}
