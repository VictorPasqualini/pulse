import { useEffect, useState } from "react";
import { View, Text, Button, FlatList, TextInput } from "react-native";
import { api } from "../lib/api";


type User = { id: string; name: string; email: string };


export default function Home() {
    const [users, setUsers] = useState<User[]>([]);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");


    async function load() {
        const { data } = await api.get<User[]>("/users");
        setUsers(data);
    }


    async function add() {
        await api.post("/users", { name, email, password });
        setName(""); setEmail(""); setPassword("");
        load();
    }


    useEffect(() => { load(); }, []);


    return (
        <View style={{ padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: "600" }}>Usuários</Text>
            <FlatList
                data={users}
                keyExtractor={(u) => u.id}
                renderItem={({ item }) => (
                <Text>{item.name} — {item.email}</Text>
                )}
            />


            <Text style={{ marginTop: 16, fontWeight: "600" }}>Adicionar</Text>
            <TextInput placeholder="Nome" value={name} onChangeText={setName} style={{ borderWidth: 1, padding: 8 }} />
            <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={{ borderWidth: 1, padding: 8 }} />
            <TextInput placeholder="Senha" value={password} onChangeText={setPassword} secureTextEntry style={{ borderWidth: 1, padding: 8 }} />
            <Button title="Salvar" onPress={add} />
        </View>
    );
}