import { Pressable, Text, TextInput, View } from "react-native";

function Label({ text }: { text: string }) {
  return (
    <Text className="mb-2 text-xs font-bold uppercase text-safeplus-muted">
      {text}
    </Text>
  );
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <Text className="mt-1 text-xs font-bold text-red-600">{message}</Text>;
}

export function EditField({
  label,
  value,
  onChangeText,
  error,
  multiline,
  hint,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  multiline?: boolean;
  hint?: string;
  keyboardType?: "default" | "phone-pad" | "numeric" | "email-address";
}) {
  return (
    <View className="py-2">
      <Label text={label} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={hint}
        placeholderTextColor="#9AA79F"
        textAlignVertical={multiline ? "top" : "center"}
        className={`rounded-2xl border bg-safeplus-paleGreen px-4 text-base text-safeplus-text ${
          multiline ? "min-h-24 py-3" : "h-14"
        } ${error ? "border-red-500" : "border-safeplus-border"}`}
      />
      <ErrorText message={error} />
    </View>
  );
}

export function ChipField({
  label,
  value,
  options,
  onChange,
  error,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <View className="py-2">
      <Label text={label} />
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(selected ? "" : option)}
              className={`rounded-full border px-4 py-2 ${
                selected
                  ? "border-safeplus-green bg-safeplus-green"
                  : "border-safeplus-border bg-white"
              }`}
            >
              <Text
                className={`text-sm font-bold ${
                  selected ? "text-white" : "text-safeplus-text"
                }`}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ErrorText message={error} />
    </View>
  );
}