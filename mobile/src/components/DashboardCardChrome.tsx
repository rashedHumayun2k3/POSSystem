import {useState} from "react";
import {Pressable,StyleSheet,Text,View,useWindowDimensions} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {colors} from "../theme";

export function DashboardCardHeader({title,context,open,onPress,bn}:{title:string;context?:string;open:boolean;onPress:()=>void;bn:boolean}){
 const [hovered,setHovered]=useState(false);
 return <Pressable accessibilityRole="button" accessibilityState={{expanded:open}}
  accessibilityLabel={`${title}, ${open?(bn?"সংক্ষিপ্ত করুন":"collapse details"):(bn?"বিস্তারিত দেখুন":"expand details")}`}
  onHoverIn={()=>setHovered(true)} onHoverOut={()=>setHovered(false)} onPress={onPress} style={({pressed})=>[dashboardCardStyles.header,hovered&&{opacity:.8},pressed&&{opacity:.6,transform:[{scale:.99}]}]}>
  <View style={dashboardCardStyles.headingCopy}><Text style={dashboardCardStyles.title}>{title}</Text>{context?<Text style={dashboardCardStyles.context}>{context}</Text>:null}</View>
  <View style={[dashboardCardStyles.toggle,open&&dashboardCardStyles.toggleOpen]}>
   <Ionicons name={open?"chevron-up":"chevron-down"} size={18} color={open?colors.primaryDark:colors.secondary}/>
  </View>
 </Pressable>;
}
export function useDashboardAmountStyle(){
 const {width}=useWindowDimensions();
 const fontSize=Math.min(24,Math.max(20,20+(width-320)/112));
 return {fontSize,lineHeight:Math.round(fontSize*1.35)};
}
export const dashboardCardStyles=StyleSheet.create({
 card:{width:"100%",backgroundColor:colors.card,borderColor:colors.divider,borderWidth:1,borderRadius:16,padding:14,gap:12,shadowColor:"#172033",shadowOffset:{width:0,height:2},shadowOpacity:.05,shadowRadius:8,elevation:1},
 collapsed:{minHeight:132,paddingVertical:10,paddingHorizontal:12,gap:4},
 collapsedSummary:{gap:3},
 collapsedAmount:{fontSize:20,lineHeight:26},
 open:{borderColor:colors.secondaryBorder},
 header:{flexDirection:"row",alignItems:"center",gap:12,minHeight:44},
 headingCopy:{flex:1,minWidth:0,gap:2},title:{fontSize:14,fontWeight:"700",lineHeight:21,color:colors.heading},
 context:{fontSize:13,lineHeight:19,color:"#5B6676"},
 toggle:{width:32,height:32,borderRadius:10,alignItems:"center",justifyContent:"center"},
 toggleOpen:{opacity:1},
 summary:{justifyContent:"center",gap:7},
 amount:{fontSize:24,lineHeight:32,fontWeight:"600",fontVariant:["tabular-nums"],color:colors.heading},
 secondary:{fontSize:13,lineHeight:19,color:"#5B6676"},
 filters:{flexDirection:"row",flexWrap:"wrap",gap:6},
 filter:{borderWidth:1,borderColor:colors.divider,borderRadius:10,paddingHorizontal:12,minHeight:38,justifyContent:"center",backgroundColor:colors.card},
 filterActive:{backgroundColor:colors.primaryLight,borderColor:colors.secondaryBorder},
 label:{fontSize:13,lineHeight:19,fontWeight:"600",color:colors.heading},
 caption:{fontSize:13,lineHeight:19,color:"#5B6676"},
 link:{fontSize:12,lineHeight:18,fontWeight:"600",color:colors.primaryDark},
 sectionTitle:{fontSize:12,lineHeight:18,fontWeight:"600",color:colors.heading},
 list:{gap:6},
 surface:{paddingVertical:4,gap:4},
 row:{flexDirection:"row",alignItems:"center",gap:8,minHeight:30},
 rowCopy:{flex:1,minWidth:0,gap:2},
 value:{fontSize:16,lineHeight:22,fontWeight:"600",fontVariant:["tabular-nums"],color:colors.heading,flexShrink:1,textAlign:"right"},
 dot:{width:9,height:9,borderRadius:5},
 metrics:{flexDirection:"row",flexWrap:"wrap",gap:6},
 metric:{flexGrow:1,flexBasis:"42%",minWidth:0,paddingVertical:4,gap:3},
 metricValue:{fontSize:16,lineHeight:22,fontWeight:"600",fontVariant:["tabular-nums"],color:colors.heading},
 footer:{borderTopWidth:1,borderTopColor:colors.divider,paddingTop:6,minHeight:44,justifyContent:"center"},
 note:{fontSize:13,color:"#5B6676",lineHeight:19,paddingVertical:4},
 state:{minHeight:88,justifyContent:"center",alignItems:"center",gap:10},
 detail:{borderTopWidth:1,borderTopColor:colors.divider,paddingTop:8,gap:8},
});
